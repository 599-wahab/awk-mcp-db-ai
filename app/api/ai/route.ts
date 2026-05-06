import { prisma } from "@/lib/prisma";
import {
  cleanSQL,
  injectTenantScopeSQL,
  isSafeSQL,
  validateTenantScopedSQL,
} from "@/lib/sql-guard";
import { AIProviderFactory } from "@/lib/ai/factory";
import type { AIProviderType } from "@/lib/ai/types";
import { getAppSchema } from "@/lib/memory/schema-loader";
import type { DatabaseSchema } from "@/lib/memory/schema-loader";
import { PrismaClient } from "@prisma/client";
import { auth } from "@/lib/auth";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, x-api-key, X-API-Key, x-tenant-id, x-user-id, x-user-email, x-widget-mode",
  "Access-Control-Max-Age": "86400",
};

type ScopeMode = "auto" | "database" | "tenant" | "user" | "hybrid";

type AppContextConfig = {
  widgetMode?: "general" | "erp";
  dataScope?: {
    mode?: ScopeMode;
    tenantColumn?: string;
    userColumn?: string;
    tenantId?: string;
    fixedTenantId?: string;
    trustedTenantId?: string;
  };
  routeMap?: Record<string, string>;
};

type ScopeFilter = {
  column: string;
  value: string;
};

type ChatHistoryItem = {
  content?: string;
  isUser?: boolean;
};

type BotContext = {
  tenantId: string | null;
  userId: string | null;
  role: "SUPER_ADMIN" | "USER";
  source: "embedded" | "standalone";
  allowGlobal: boolean;
};

type SessionWithBotUser = {
  user?: {
    id?: string;
    role?: string;
  };
};

type SchemaColumn = {
  table_name: string;
  column_name: string;
  data_type: string;
  is_nullable?: string;
};

type QueryRow = Record<string, unknown>;

type BotAction =
  | { type: "navigate"; href: string; label?: string }
  | {
      type: "open_record";
      entity: "invoice" | "product" | "customer" | "staff" | "team" | "task";
      id: string;
      label?: string;
      href?: string;
      payload?: Record<string, unknown>;
    }
  | { type: "show_summary"; entity: string; payload: Record<string, unknown> }
  | { type: "clarify"; question: string; options?: string[] };

const DEFAULT_ROUTE_MAP: Record<string, string> = {
  dashboard: "/dashboard",
  inventory: "/dashboard/inventory",
  products: "/dashboard/products",
  sales: "/dashboard/sales",
  purchases: "/dashboard/purchases",
  customers: "/dashboard/customers",
  staff: "/dashboard/staff",
  teams: "/dashboard/teams",
  tasks: "/dashboard/tasks",
  myTasks: "/dashboard/my-tasks",
  reports: "/dashboard/reports",
  notifications: "/dashboard/notifications",
  invoices: "/dashboard/invoices",
  subscription: "/dashboard/subscription",
  settings: "/dashboard/settings",
};

const TENANT_COLUMN_CANDIDATES = [
  "tenant_id",
  "tenantid",
  "company_id",
  "companyid",
  "organization_id",
  "organisation_id",
  "org_id",
  "workspace_id",
  "business_id",
];

const USER_COLUMN_CANDIDATES = [
  "user_id",
  "userid",
  "owner_id",
  "employee_user_id",
  "staff_user_id",
  "created_by",
  "created_by_user_id",
];

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

function detectLang(text: string): "ur" | "en" {
  if (/[\u0600-\u06FF]/.test(text)) return "ur";
  if (
    /\b(kya|hai|hain|aap|mujhe|batao|dikhao|kitne|kitni|total|salary|order|sale)\b/i.test(
      text,
    )
  ) {
    return "ur";
  }
  return "en";
}

function friendlyError(msg: string): { message: string; errorType: string } {
  if (msg === "QUOTA_EXCEEDED") {
    return {
      message:
        "AI API quota exceeded. Get a new free key from aistudio.google.com and update it in Settings.",
      errorType: "QUOTA_EXCEEDED",
    };
  }
  if (msg === "INVALID_KEY") {
    return {
      message: "AI API key is invalid. Check your key in Settings.",
      errorType: "INVALID_KEY",
    };
  }
  if (msg === "NO_KEY") {
    return {
      message: "No AI API key. Go to Settings and add your Gemini/OpenAI key.",
      errorType: "NO_KEY",
    };
  }
  if (msg === "MODEL_NOT_FOUND") {
    return {
      message:
        "AI model not found. Update the model name in Settings, for example gemini-2.5-flash, or leave the model field blank.",
      errorType: "MODEL_NOT_FOUND",
    };
  }
  if (msg === "MISSING_TENANT_CONTEXT") {
    return {
      message:
        "I can’t access company data until a tenant/company context is selected.",
      errorType: "MISSING_TENANT_CONTEXT",
    };
  }
  if (msg === "AI_OVERLOADED") {
    return {
      message:
        "Gemini is busy right now. Please try again, or switch this app to another AI provider/model in Settings.",
      errorType: "AI_OVERLOADED",
    };
  }
  if (msg.includes("ECONNREFUSED")) {
    return {
      message:
        "Cannot connect to local AI. Make sure LM Studio or Ollama is running.",
      errorType: "CONNECTION_ERROR",
    };
  }
  return {
    message: "AI error: " + msg.replace("AI_ERROR:", "").slice(0, 100),
    errorType: "AI_ERROR",
  };
}

function serialize(result: QueryRow[]): QueryRow[] {
  return result.map((row) => {
    const obj: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(row)) {
      if (typeof value === "bigint") obj[key] = Number(value);
      else if (value instanceof Date) obj[key] = value.toISOString();
      else obj[key] = value;
    }
    return obj;
  });
}

function filterSmartResult(result: QueryRow[]): QueryRow[] {
  if (!result?.length) return result;

  const keys = Object.keys(result[0]);
  const nameKey = keys.find((key) =>
    ["name", "item_name", "product_name"].includes(key.toLowerCase()),
  );

  let filtered = result;
  if (nameKey) {
    filtered = filtered.filter((row) => {
      const value = String(row[nameKey] || "");
      return !value.startsWith("[DELETED]") && !value.startsWith("DELETED");
    });
  }

  if (nameKey && filtered.length > 0) {
    const priceKey = keys.find((key) =>
      key.toLowerCase().includes("price") || key.toLowerCase().includes("amount"),
    );
    if (priceKey) {
      const seen = new Map<string, QueryRow>();
      filtered.forEach((row) => {
        const name = String(row[nameKey]).toLowerCase().trim();
        const price = Number(row[priceKey]) || 0;
        const existing = seen.get(name);
        if (!existing || price > Number(existing[priceKey])) {
          seen.set(name, row);
        }
      });
      filtered = Array.from(seen.values());
    }
  }

  return filtered;
}

function needsClarification(
  question: string,
  lang: "ur" | "en",
): string | null {
  const q = question.toLowerCase().trim();

  if (q.split(" ").length <= 2 && !q.includes("?")) {
    if (lang === "ur") {
      return "براہ کرم تھوڑی مزید تفصیل دیں، جیسے کس تاریخ، کس پروڈکٹ، یا کس کسٹمر کے بارے میں پوچھ رہے ہیں۔";
    }
    return "Could you be more specific? For example, which date range, product, or customer are you asking about?";
  }

  const hasAll = /\b(all|sab|تمام)\b/.test(q);
  const hasFilter = /\b(where|filter|date|month|week|year|customer|product)\b/.test(
    q,
  );

  if (hasAll && !hasFilter) {
    if (lang === "ur") {
      return "اگر آپ سب ریکارڈز دیکھنا چاہتے ہیں تو بہتر نتیجے کے لیے تاریخ، نام، یا کسی خاص فلٹر کے ساتھ پوچھیں۔";
    }
    return "If you want all records, please add a filter like date, month, or a specific name for a better result.";
  }

  return null;
}

function detectViz(result: QueryRow[], question: string): string {
  if (!result?.length) return "none";

  const q = question.toLowerCase();
  if (q.includes("stacked")) return "stacked";
  if (q.includes("pie")) return "pie";
  if (q.includes("bar")) return "bar";
  if (q.includes("line") || q.includes("trend")) return "line";
  if (q.includes("chart")) return "bar";

  const keys = Object.keys(result[0]);
  const numKeys = keys.filter((key) => typeof result[0][key] === "number");
  const textKeys = keys.filter((key) => typeof result[0][key] !== "number");

  if (textKeys.length >= 1 && numKeys.length >= 1 && result.length > 3) {
    return "table";
  }
  if (result.length === 1 && numKeys.length === 1) return "kpi";
  if (result.length > 1 && numKeys.length >= 1) return "line";
  return "table";
}

function pivotStacked(result: QueryRow[]): QueryRow[] {
  if (!result.length || !("category" in result[0])) return result;

  const map: Record<string, Record<string, unknown>> = {};
  result.forEach((row) => {
    const monthKey = String(row.month);
    const categoryKey = String(row.category);
    if (!map[monthKey]) {
      map[monthKey] = {
        month: new Date(monthKey).toLocaleString("default", {
          month: "short",
          year: "numeric",
        }),
      };
    }
    map[monthKey][categoryKey] = Number(row.total_amount);
  });
  return Object.values(map);
}

function getInsights(result: QueryRow[]) {
  if (!result?.length || result.length < 2) return [];

  const keys = Object.keys(result[0]);
  const numKey = keys.find((key) => typeof result[0][key] === "number");
  const labelKey = keys.find((key) => typeof result[0][key] !== "number");
  if (!numKey || !labelKey) return [];

  const sorted = [...result].sort((a, b) => Number(b[numKey]) - Number(a[numKey]));
  return [
    `${sorted[0][labelKey]} has the highest value (${Number(sorted[0][numKey]).toLocaleString()}).`,
    `${sorted[sorted.length - 1][labelKey]} has the lowest value (${Number(sorted[sorted.length - 1][numKey]).toLocaleString()}).`,
  ];
}

function getQuestionSubject(question: string): string {
  const q = question.toLowerCase();
  const subjects = [
    "staff",
    "customer",
    "customers",
    "product",
    "products",
    "supplier",
    "suppliers",
    "invoice",
    "invoices",
    "room",
    "rooms",
    "booking",
    "bookings",
    "task",
    "tasks",
    "sale",
    "sales",
    "income",
    "revenue",
  ];
  return subjects.find((subject) => q.includes(subject)) || "record";
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "0";
  if (typeof value === "number") return value.toLocaleString();
  if (typeof value === "bigint") return Number(value).toLocaleString();
  return String(value);
}

function buildLocalExplanation(args: {
  question: string;
  result: Array<Record<string, unknown>>;
  detectedLang: "ur" | "en";
}): string {
  const { question, result, detectedLang } = args;
  const subject = getQuestionSubject(question);
  const isUr = detectedLang === "ur";

  if (!result.length) {
    return isUr
      ? "اس سوال کے لئے کوئی ریکارڈ نہیں ملا۔"
      : `No ${subject} records matched your question.`;
  }

  const first = result[0];
  const entries = Object.entries(first);

  if (result.length === 1 && entries.length === 1) {
    const [key, value] = entries[0];
    const formatted = formatValue(value);
    const loweredKey = key.toLowerCase();

    if (value === null) {
      return isUr
        ? "اس مدت کے لئے کوئی رقم موجود نہیں ملی۔"
        : `No ${subject} amount was found for that period.`;
    }

    if (/count|total|sum|revenue|income|amount/i.test(loweredKey)) {
      return isUr
        ? `نتیجہ ${formatted} ہے۔`
        : subject === "income" || subject === "revenue" || subject === "sales"
          ? `The ${subject} total is ${formatted}.`
          : `You have ${formatted} ${subject}${formatted === "1" ? "" : "s"}.`;
    }
  }

  const nameKey = Object.keys(first).find((key) =>
    /(^name$|full_name|customer_name|company_name|product_name|title)/i.test(key),
  );
  if (nameKey && result.length === 1) {
    return isUr
      ? `ایک متعلقہ ریکارڈ ملا: ${String(first[nameKey])}۔`
      : `I found one matching ${subject}: ${String(first[nameKey])}.`;
  }

  return isUr
    ? `${result.length} متعلقہ ریکارڈ ملے۔`
    : `Found ${result.length} matching ${subject} record${result.length === 1 ? "" : "s"}.`;
}

function shouldUseAiExplanation() {
  return process.env.ENABLE_AI_EXPLANATIONS === "true";
}

function parseAppContext(raw: string | null | undefined): AppContextConfig {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function normalizeValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function isExplicitGlobalQuestion(question: string): boolean {
  return /\b(global|system[-\s]?wide|all tenants|all companies|across tenants|across companies)\b/i.test(
    question,
  );
}

function resolveConfiguredTenant(context: AppContextConfig): string {
  return (
    normalizeValue(context.dataScope?.tenantId) ||
    normalizeValue(context.dataScope?.fixedTenantId) ||
    normalizeValue(context.dataScope?.trustedTenantId)
  );
}

function getSessionUser(session: unknown) {
  const user = (session as SessionWithBotUser | null)?.user;
  return {
    id: normalizeValue(user?.id),
    role: user?.role === "SUPER_ADMIN" ? "SUPER_ADMIN" : "USER",
  } as const;
}

function resolveBotContext(args: {
  req: Request;
  appUserId: string;
  appContext: AppContextConfig;
  question: string;
  session: unknown;
}): BotContext {
  const sessionUser = getSessionUser(args.session);
  const configuredTenantId = resolveConfiguredTenant(args.appContext);
  const source: BotContext["source"] =
    args.session && sessionUser.id === args.appUserId ? "standalone" : "embedded";
  const role = sessionUser.role;
  const allowGlobal =
    role === "SUPER_ADMIN" && isExplicitGlobalQuestion(args.question);

  return {
    tenantId: configuredTenantId || null,
    userId: sessionUser.id || null,
    role,
    source,
    allowGlobal,
  };
}

function tenantContextError() {
  return Response.json(
    {
      error:
        "I can’t access company data until a tenant/company context is selected.",
      errorType: "MISSING_TENANT_CONTEXT",
    },
    { status: 403, headers: CORS },
  );
}

function escapeSqlLiteral(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

function isLikelySafeScopeValue(value: string): boolean {
  return !!value && value.length <= 160 && !/[\r\n;\0]/.test(value);
}

function getSchemaColumns(schema: DatabaseSchema): Set<string> {
  const columns = Array.isArray(schema.tables) ? schema.tables : [];
  return new Set(
    columns
      .map((column) => String(column?.column_name || "").toLowerCase())
      .filter(Boolean),
  );
}

function hasTenantOwnedTables(schema: DatabaseSchema, tenantColumn = "tenant_id"): boolean {
  const columns = Array.isArray(schema.tables) ? schema.tables : [];
  return columns.some(
    (column) =>
      String(column?.column_name || "").toLowerCase() ===
      tenantColumn.toLowerCase(),
  );
}

function buildSchemaGuide(schema: DatabaseSchema, tenantColumn = "tenant_id") {
  const grouped = new Map<string, SchemaColumn[]>();
  for (const column of schema.tables || []) {
    const columns = grouped.get(column.table_name) || [];
    columns.push(column);
    grouped.set(column.table_name, columns);
  }

  const tableLines = [...grouped.entries()]
    .map(([tableName, columns]) => {
      const columnText = columns
        .map((column) => `${column.column_name}:${column.data_type}`)
        .join(", ");
      return `- ${tableName}(${columnText})`;
    })
    .join("\n");

  const tenantTables = [...grouped.entries()]
    .filter(([, columns]) =>
      columns.some(
        (column) => column.column_name.toLowerCase() === tenantColumn.toLowerCase(),
      ),
    )
    .map(([tableName]) => tableName);

  const nameColumns = [...grouped.entries()]
    .map(([tableName, columns]) => {
      const matches = columns
        .filter((column) =>
          /(^name$|full_name|customer_name|company_name|first_name|last_name|email|phone|title|code)/i.test(
            column.column_name,
          ),
        )
        .map((column) => column.column_name);
      return matches.length ? `${tableName}: ${matches.join(", ")}` : "";
    })
    .filter(Boolean)
    .join("\n");

  const moneyColumns = [...grouped.entries()]
    .map(([tableName, columns]) => {
      const matches = columns
        .filter((column) =>
          /(amount|total|income|revenue|price|paid|payment|subtotal|balance|cost)/i.test(
            column.column_name,
          ),
        )
        .map((column) => column.column_name);
      return matches.length ? `${tableName}: ${matches.join(", ")}` : "";
    })
    .filter(Boolean)
    .join("\n");

  return {
    tableLines,
    tenantTables,
    nameColumns,
    moneyColumns,
  };
}

function findMatchingColumn(
  schema: DatabaseSchema,
  configuredColumn: string | undefined,
  candidates: string[],
): string | null {
  if (configuredColumn?.trim()) return configuredColumn.trim();

  const columns = getSchemaColumns(schema);
  for (const candidate of candidates) {
    if (columns.has(candidate.toLowerCase())) return candidate;
  }
  return null;
}

function buildScopeFilters(args: {
  schema: DatabaseSchema;
  context: AppContextConfig;
  tenantId: string;
  userId: string;
}) {
  const mode = args.context.dataScope?.mode || "auto";
  const tenantColumn = findMatchingColumn(
    args.schema,
    args.context.dataScope?.tenantColumn,
    TENANT_COLUMN_CANDIDATES,
  );
  const userColumn = findMatchingColumn(
    args.schema,
    args.context.dataScope?.userColumn,
    USER_COLUMN_CANDIDATES,
  );

  const filters: ScopeFilter[] = [];

  if (mode === "database") {
    return { mode, filters, tenantColumn, userColumn };
  }

  if (
    ["auto", "tenant", "hybrid"].includes(mode) &&
    args.tenantId &&
    tenantColumn &&
    isLikelySafeScopeValue(args.tenantId)
  ) {
    filters.push({ column: tenantColumn, value: args.tenantId });
  }

  if (
    ["auto", "user", "hybrid"].includes(mode) &&
    args.userId &&
    userColumn &&
    isLikelySafeScopeValue(args.userId)
  ) {
    filters.push({ column: userColumn, value: args.userId });
  }

  return { mode, filters, tenantColumn, userColumn };
}

function injectScopeFilters(sql: string, filters: ScopeFilter[]): string {
  let nextSql = sql;

  for (const filter of filters) {
    const alreadyScoped = new RegExp(`\\b${filter.column}\\b`, "i").test(nextSql);
    if (alreadyScoped) continue;

    const condition = `${filter.column} = ${escapeSqlLiteral(filter.value)}`;

    if (/\bWHERE\b/i.test(nextSql)) {
      nextSql = nextSql.replace(/\bWHERE\b/i, `WHERE ${condition} AND `);
      continue;
    }

    let inserted = false;
    for (const keyword of ["GROUP BY", "ORDER BY", "LIMIT", "HAVING"]) {
      const re = new RegExp(`\\b${keyword}\\b`, "i");
      if (re.test(nextSql)) {
        nextSql = nextSql.replace(re, `WHERE ${condition} ${keyword}`);
        inserted = true;
        break;
      }
    }

    if (!inserted) {
      nextSql = nextSql.replace(/;?\s*$/, ` WHERE ${condition}`);
    }
  }

  return nextSql;
}

function getFieldValue(
  row: QueryRow,
  candidates: readonly string[],
): unknown {
  const entries = Object.entries(row);
  for (const candidate of candidates) {
    const found = entries.find(
      ([key, value]) =>
        key.toLowerCase() === candidate.toLowerCase() &&
        value !== null &&
        value !== undefined &&
        value !== "",
    );
    if (found) return found[1];
  }
  return undefined;
}

function pickSummaryFields(
  row: QueryRow,
  candidates: readonly string[],
): Record<string, unknown> {
  const summary: Record<string, unknown> = {};
  for (const candidate of candidates) {
    const value = getFieldValue(row, [candidate]);
    if (value !== undefined) summary[candidate] = value;
  }
  return summary;
}

function buildErpActions(
  question: string,
  result: QueryRow[],
  routeMap: Record<string, string>,
): BotAction[] {
  const q = question.toLowerCase();
  const actions: BotAction[] = [];

  const pageMatchers: Array<{
    key: keyof typeof DEFAULT_ROUTE_MAP;
    words: string[];
    label: string;
  }> = [
    { key: "dashboard", words: ["dashboard", "home"], label: "Open dashboard" },
    { key: "inventory", words: ["inventory", "stock"], label: "Open inventory" },
    { key: "products", words: ["product", "products"], label: "Open products" },
    { key: "customers", words: ["customer", "customers", "client"], label: "Open customers" },
    { key: "sales", words: ["sale", "sales"], label: "Open sales" },
    { key: "purchases", words: ["purchase", "purchases"], label: "Open purchases" },
    { key: "tasks", words: ["task", "tasks"], label: "Open tasks" },
    { key: "reports", words: ["report", "reports"], label: "Open reports" },
    { key: "invoices", words: ["invoice", "invoices", "bill"], label: "Open invoices" },
    { key: "staff", words: ["staff", "employee"], label: "Open staff" },
    { key: "teams", words: ["team", "teams"], label: "Open teams" },
    { key: "settings", words: ["setting", "settings"], label: "Open settings" },
  ];

  const pageIntent = pageMatchers.find((item) =>
    item.words.some((word) => q.includes(word)),
  );
  if (pageIntent && routeMap[pageIntent.key]) {
    actions.push({
      type: "navigate",
      href: routeMap[pageIntent.key],
      label: pageIntent.label,
    });
  }

  const entityConfigs = {
    invoice: {
      routeKey: "invoices",
      idFields: ["invoice_number", "invoice_no", "invoice_id", "id", "number"],
      labelFields: ["invoice_number", "invoice_no", "number", "customer_name", "name"],
      summaryFields: ["invoice_number", "customer_name", "date", "total", "status", "due_amount"],
    },
    product: {
      routeKey: "products",
      idFields: ["id", "product_id", "code", "product_code", "barcode"],
      labelFields: ["product_name", "name", "product_code", "code"],
      summaryFields: ["product_name", "name", "product_code", "barcode", "stock", "price"],
    },
    customer: {
      routeKey: "customers",
      idFields: ["id", "customer_id", "code", "customer_code", "email", "phone"],
      labelFields: ["company_name", "customer_name", "name", "code"],
      summaryFields: ["company_name", "customer_name", "name", "phone", "email", "balance"],
    },
    staff: {
      routeKey: "staff",
      idFields: ["id", "staff_id", "employee_id"],
      labelFields: ["full_name", "name", "employee_id"],
      summaryFields: ["full_name", "name", "employee_id", "role", "shift"],
    },
    team: {
      routeKey: "teams",
      idFields: ["id", "team_id", "name"],
      labelFields: ["name", "team_name"],
      summaryFields: ["name", "team_name", "lead", "leader"],
    },
    task: {
      routeKey: "tasks",
      idFields: ["id", "task_id", "title"],
      labelFields: ["title", "name", "task_name"],
      summaryFields: ["title", "assignee", "status", "priority", "deadline"],
    },
  } as const;

  const detectedEntity = (Object.keys(entityConfigs) as Array<
    keyof typeof entityConfigs
  >).find(
    (entity) => q.includes(entity) || (entity === "invoice" && q.includes("bill")),
  );

  if (!detectedEntity || !Array.isArray(result) || result.length === 0) {
    return actions;
  }

  const config = entityConfigs[detectedEntity];

  if (result.length > 1) {
    const options = result.slice(0, 3).map((row) => {
      const label =
        getFieldValue(row, config.labelFields) ?? getFieldValue(row, config.idFields);
      return String(label ?? "Record");
    });
    actions.push({
      type: "clarify",
      question: `I found multiple ${detectedEntity}s. Which one do you want to open?`,
      options,
    });
    return actions;
  }

  const row = result[0];
  const recordId = getFieldValue(row, config.idFields);
  const label = getFieldValue(row, config.labelFields);
  const href = routeMap[config.routeKey];
  const payload = pickSummaryFields(row, config.summaryFields);

  if (recordId !== undefined && recordId !== null) {
    actions.push({
      type: "open_record",
      entity: detectedEntity,
      id: String(recordId),
      label: label ? `Open ${label}` : `Open ${detectedEntity}`,
      href,
      payload,
    });
  } else if (Object.keys(payload).length > 0) {
    actions.push({
      type: "show_summary",
      entity: detectedEntity,
      payload,
    });
  }

  return actions;
}

export async function POST(req: Request) {
  const session = await auth();
  const apiKey =
    req.headers.get("x-api-key") || req.headers.get("X-API-Key") || "";

  if (!apiKey) {
    return Response.json(
      { error: "API key required.", errorType: "NO_API_KEY" },
      { status: 401, headers: CORS },
    );
  }

  const body = await req.json();
  const question = normalizeValue(body?.question);
  const preferredLang = body?.preferredLang;
  const userEmail =
    normalizeValue(body?.userEmail) ||
    normalizeValue(req.headers.get("x-user-email"));
  const widgetModeFromRequest =
    normalizeValue(body?.widgetMode) ||
    normalizeValue(req.headers.get("x-widget-mode"));
  const chatHistory = Array.isArray(body?.chatHistory)
    ? (body.chatHistory as ChatHistoryItem[])
    : [];

  if (!question) {
    return Response.json(
      { error: "Question is required." },
      { status: 400, headers: CORS },
    );
  }

  const app = await prisma.connectedApp.findUnique({
    where: { apiKey },
    select: {
      id: true,
      userId: true,
      isActive: true,
      dbUrl: true,
      geminiKey: true,
      aiProvider: true,
      aiModel: true,
      aiBaseUrl: true,
      contextJson: true,
    },
  });

  if (!app || !app.isActive) {
    return Response.json(
      { error: "Invalid or inactive API key.", errorType: "INVALID_API_KEY" },
      { status: 401, headers: CORS },
    );
  }

  if (!app.dbUrl) {
    return Response.json(
      { error: "No database URL. Add it in Settings.", errorType: "NO_DB" },
      { status: 400, headers: CORS },
    );
  }

  const detectedLang =
    preferredLang === "ur"
      ? "ur"
      : preferredLang === "en"
        ? "en"
        : detectLang(question);

  const providerType = (app.aiProvider || "GEMINI").toLowerCase();
  const aiApiKey = app.geminiKey || undefined;
  const aiBaseUrl = app.aiBaseUrl || undefined;
  const aiModel = app.aiModel || undefined;
  const provider = AIProviderFactory.createProvider({
    type: providerType as AIProviderType,
  });

  let schema: DatabaseSchema;
  try {
    schema = await getAppSchema(app.id);
  } catch (error) {
    return Response.json(
      {
        error:
          "I can’t read this app’s database schema yet. Fix the database URL, then click Rebuild Schema.",
        errorType: "SCHEMA_UNAVAILABLE",
        detail: error instanceof Error ? error.message : "Schema load failed",
      },
      { status: 400, headers: CORS },
    );
  }

  const appContext = parseAppContext(app.contextJson);
  const botContext = resolveBotContext({
    req,
    appUserId: app.userId,
    appContext,
    question,
    session,
  });
  const widgetMode =
    widgetModeFromRequest === "erp" || appContext.widgetMode === "erp"
      ? "erp"
      : "general";
  const scope = buildScopeFilters({
    schema,
    context: appContext,
    tenantId: botContext.tenantId || "",
    userId: botContext.userId || "",
  });

  if (
    scope.mode !== "database" &&
    !botContext.allowGlobal &&
    !botContext.tenantId
  ) {
    if (hasTenantOwnedTables(schema, scope.tenantColumn || "tenant_id")) {
      return tenantContextError();
    }
  }

  if (
    scope.mode !== "database" &&
    !botContext.allowGlobal &&
    !scope.filters.length &&
    (botContext.tenantId || botContext.userId || scope.tenantColumn || scope.userColumn)
  ) {
    return Response.json(
      {
        error:
          "I can’t access company data until a tenant/company context is selected.",
        errorType: "MISSING_SCOPE",
      },
      { status: 400, headers: CORS },
    );
  }

  const clarify = needsClarification(question, detectedLang);
  if (clarify) {
    return Response.json(
      {
        explanation: clarify,
        isClarification: true,
        detectedLang,
        sql: null,
        result: null,
        visualization: "none",
        actions: [],
        insights: [],
        chatLogId: null,
      },
      { headers: CORS },
    );
  }

  let contextPrompt = question;
  if (chatHistory.length) {
    const recent = chatHistory.slice(-4);
    const historyText = recent
      .map((item) =>
        item.isUser
          ? `User: ${item.content || ""}`
          : `Assistant result: ${String(item.content || "").slice(0, 120)}`,
      )
      .join("\n");
    contextPrompt = `Previous context:\n${historyText}\n\nCurrent question: ${question}`;
  }

  const scopeHint =
    botContext.allowGlobal
      ? "IMPORTANT: This is an explicit superadmin global/system-wide query. Keep it read-only and avoid exposing secrets."
      : scope.filters.length > 0
      ? `IMPORTANT: Apply these filters to every query: ${scope.filters
          .map((filter) => `${filter.column} = ${escapeSqlLiteral(filter.value)}`)
          .join(" AND ")}. Never return data outside this scope.`
      : scope.mode === "database"
        ? "IMPORTANT: This app uses one isolated database per customer. Keep queries read-only and only fetch records needed for the request."
        : "IMPORTANT: Keep queries read-only, precise, and limited to only the records needed for the request.";

  const promptPrefix =
    widgetMode === "erp"
      ? "[ERP widget mode: only support safe read-only ERP help. Prefer locating the requested invoice, product, customer, staff member, team, or task. Do not behave like a general database assistant.]"
      : "";

  const schemaGuide = buildSchemaGuide(schema, scope.tenantColumn || "tenant_id");
  const schemaWithHint = {
    ...schema,
    _tables: schemaGuide.tableLines,
    _tenantOwnedTables: schemaGuide.tenantTables,
    _nameSearchColumns: schemaGuide.nameColumns,
    _moneyAndRevenueColumns: schemaGuide.moneyColumns,
    _hint:
      `${scopeHint} ` +
      "Use the _tables list as the source of truth. For 'who is X' or name searches, search only real name/email/phone/code/title columns from _nameSearchColumns with ILIKE. For income/revenue/sales questions, prefer real amount/total/payment columns from _moneyAndRevenueColumns. Exclude soft-deleted records when name is prefixed with [DELETED]. Use DISTINCT to avoid duplicates. Never return SELECT 'UNABLE_TO_QUERY' if a reasonable query can be made from the schema.",
  };

  const prompt = `${promptPrefix}\n${scopeHint}\nTenant ID: ${botContext.tenantId || "none"}\nUser ID: ${botContext.userId || "unknown"}\nUser Email: ${userEmail || "unknown"}\nBot source: ${botContext.source}\nRole: ${botContext.role}\n\n${contextPrompt}`.trim();

  let sql = "";
  try {
    const raw = await provider.generateSQL(
      prompt,
      JSON.stringify(schemaWithHint),
      aiApiKey,
      aiBaseUrl,
      aiModel,
    );
    sql = cleanSQL(raw);
  } catch (err: unknown) {
    const fe = friendlyError(err instanceof Error ? err.message : String(err));
    return Response.json(
      { error: fe.message, errorType: fe.errorType },
      { status: 500, headers: CORS },
    );
  }

  if (/^SELECT\s+'UNABLE_TO_QUERY'\s+AS\s+error/i.test(sql)) {
    const explanation =
      detectedLang === "ur"
        ? "میں اس سوال کے لئے موجودہ ڈیٹا بیس اسکیمہ سے محفوظ query نہیں بنا سکا۔ سوال میں table, date, product, customer, یا amount کی مزید تفصیل دیں۔"
        : "I could not build a safe query for this question from the current app schema. Please add more detail like the table, date, product, customer, or amount you want.";

    const log = await prisma.chatLog
      .create({
        data: {
          appId: app.id,
          question,
          generatedSql: sql,
          explanation,
          wasSuccessful: false,
          detectedLang,
        },
      })
      .catch(() => null);

    return Response.json(
      {
        explanation,
        error: explanation,
        errorType: "UNABLE_TO_QUERY",
        sql,
        result: [],
        visualization: "none",
        insights: [],
        chatLogId: log?.id,
        detectedLang,
      },
      { status: 422, headers: CORS },
    );
  }

  if (scope.mode !== "database" && botContext.tenantId && !botContext.allowGlobal) {
    sql = injectTenantScopeSQL({
      sql,
      schema,
      tenantId: botContext.tenantId,
      tenantColumn: scope.tenantColumn || "tenant_id",
    });
  } else if (scope.filters.length) {
    sql = injectScopeFilters(sql, scope.filters);
  }

  if (!isSafeSQL(sql)) {
    return Response.json(
      { error: "Unsafe SQL blocked.", errorType: "UNSAFE_SQL" },
      { status: 400, headers: CORS },
    );
  }

  if (scope.mode !== "database") {
    const tenantGuard = validateTenantScopedSQL({
      sql,
      schema,
      tenantId: botContext.tenantId,
      tenantColumn: scope.tenantColumn || "tenant_id",
      allowGlobal: botContext.allowGlobal,
    });
    if (!tenantGuard.ok) {
      console.warn("Tenant SQL rejected", {
        appId: app.id,
        tenantId: botContext.tenantId,
        userId: botContext.userId,
        source: botContext.source,
        role: botContext.role,
        tables: tenantGuard.tables,
      });
      return tenantContextError();
    }
  }

  const userPrisma = new PrismaClient({
    datasources: { db: { url: app.dbUrl } },
  });

  try {
    console.info("Bot query executing", {
      appId: app.id,
      tenantId: botContext.tenantId,
      userId: botContext.userId,
      source: botContext.source,
      role: botContext.role,
      global: botContext.allowGlobal,
    });
    const rawResult = (await userPrisma.$queryRawUnsafe(sql)) as QueryRow[];
    let result = serialize(rawResult);
    result = filterSmartResult(result);
    const visualization = detectViz(result, question);
    if (visualization === "stacked") result = pivotStacked(result);

    let explanation = buildLocalExplanation({
      question,
      result,
      detectedLang,
    });

    if (shouldUseAiExplanation()) {
      try {
        explanation = await provider.generateExplanation(
          detectedLang === "ur"
            ? `${question}\n\nجواب اردو میں دیں۔`
            : question,
          result,
          aiApiKey,
          aiBaseUrl,
          aiModel,
        );
      } catch {}
    }

    const actions =
      widgetMode === "erp"
        ? buildErpActions(question, result, {
            ...DEFAULT_ROUTE_MAP,
            ...(appContext.routeMap || {}),
          })
        : [];

    const log = await prisma.chatLog
      .create({
        data: {
          appId: app.id,
          question,
          generatedSql: sql,
          result: JSON.stringify(result),
          explanation,
          wasSuccessful: true,
          detectedLang,
        },
      })
      .catch(() => null);

    await prisma.connectedApp
      .update({
        where: { id: app.id },
        data: { totalChats: { increment: 1 }, lastActiveAt: new Date() },
      })
      .catch(() => {});

    return Response.json(
      {
        explanation,
        sql,
        result,
        visualization,
        actions,
        insights: getInsights(result),
        detectedLang,
        chatLogId: log?.id,
      },
      { headers: CORS },
    );
  } catch (err: unknown) {
    const sqlErrorMessage = err instanceof Error ? err.message : String(err);
    try {
      const rawFixed = await provider.fixSQL(
        sql,
        sqlErrorMessage,
        JSON.stringify(schemaWithHint),
        aiApiKey,
        aiBaseUrl,
        aiModel,
      );

      let fixedSql = cleanSQL(rawFixed);
      if (scope.mode !== "database" && botContext.tenantId && !botContext.allowGlobal) {
        fixedSql = injectTenantScopeSQL({
          sql: fixedSql,
          schema,
          tenantId: botContext.tenantId,
          tenantColumn: scope.tenantColumn || "tenant_id",
        });
      } else if (scope.filters.length) {
        fixedSql = injectScopeFilters(fixedSql, scope.filters);
      }

      if (!isSafeSQL(fixedSql)) throw new Error("Fixed SQL unsafe");

      if (scope.mode !== "database") {
        const fixedTenantGuard = validateTenantScopedSQL({
          sql: fixedSql,
          schema,
          tenantId: botContext.tenantId,
          tenantColumn: scope.tenantColumn || "tenant_id",
          allowGlobal: botContext.allowGlobal,
        });
        if (!fixedTenantGuard.ok) {
          console.warn("Fixed tenant SQL rejected", {
            appId: app.id,
            tenantId: botContext.tenantId,
            userId: botContext.userId,
            source: botContext.source,
            role: botContext.role,
            tables: fixedTenantGuard.tables,
          });
          throw new Error("MISSING_TENANT_CONTEXT");
        }
      }

      console.info("Bot fixed query executing", {
        appId: app.id,
        tenantId: botContext.tenantId,
        userId: botContext.userId,
        source: botContext.source,
        role: botContext.role,
        global: botContext.allowGlobal,
      });
      const rawResult = (await userPrisma.$queryRawUnsafe(fixedSql)) as QueryRow[];
      let result = serialize(rawResult);
      result = filterSmartResult(result);
      const visualization = detectViz(result, question);
      if (visualization === "stacked") result = pivotStacked(result);

      let explanation = buildLocalExplanation({
        question,
        result,
        detectedLang,
      });

      if (shouldUseAiExplanation()) {
        try {
          explanation = await provider.generateExplanation(
            detectedLang === "ur"
              ? `${question}\n\nجواب اردو میں دیں۔`
              : question,
            result,
            aiApiKey,
            aiBaseUrl,
            aiModel,
          );
        } catch {}
      }

      const actions =
        widgetMode === "erp"
          ? buildErpActions(question, result, {
              ...DEFAULT_ROUTE_MAP,
              ...(appContext.routeMap || {}),
            })
          : [];

      const log = await prisma.chatLog
        .create({
          data: {
            appId: app.id,
            question,
            generatedSql: fixedSql,
            result: JSON.stringify(result),
            explanation,
            wasSuccessful: true,
            detectedLang,
          },
        })
        .catch(() => null);

      await prisma.connectedApp
        .update({
          where: { id: app.id },
          data: { totalChats: { increment: 1 }, lastActiveAt: new Date() },
        })
        .catch(() => {});

      return Response.json(
        {
          explanation,
          sql: fixedSql,
          result,
          visualization,
          actions,
          insights: getInsights(result),
          detectedLang,
          chatLogId: log?.id,
        },
        { headers: CORS },
      );
    } catch (fixErr: unknown) {
      await prisma.chatLog
        .create({
          data: {
            appId: app.id,
            question,
            generatedSql: sql,
            wasSuccessful: false,
            detectedLang,
          },
        })
        .catch(() => {});

      const fe = friendlyError(
        fixErr instanceof Error ? fixErr.message : String(fixErr),
      );
      return Response.json(
        { error: fe.message, errorType: fe.errorType },
        { status: 500, headers: CORS },
      );
    }
  } finally {
    await userPrisma.$disconnect();
  }
}
