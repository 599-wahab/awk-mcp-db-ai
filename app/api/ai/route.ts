// app/api/ai/route.ts
//bot code
import { prisma } from "@/lib/prisma";
import { cleanSQL, isSafeSQL } from "@/lib/sql-guard";
import { AIProviderFactory } from "@/lib/ai/factory";
import { getAppSchema } from "@/lib/memory/schema-loader";
import { PrismaClient } from "@prisma/client";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, x-api-key, X-API-Key, x-tenant-id, X-Tenant-ID, x-company-id, X-Company-ID, x-user-id, X-User-ID, x-user-email, X-User-Email, x-user-role, X-User-Role, x-widget-mode, X-Widget-Mode",
  "Access-Control-Max-Age": "86400",
};

type ScopeMode = "auto" | "database" | "tenant" | "user" | "hybrid";
type WidgetMode = "general" | "erp";

type AppContextConfig = {
  widgetMode?: "general" | "erp" | "erp-dashboard";
  dataScope?: {
    mode?: ScopeMode;
    tenantColumn?: string;
    userColumn?: string;
  };
  routeMap?: Record<string, string>;
};

type ScopeFilter = {
  column: string;
  value: string;
  kind: "tenant" | "user";
};

type ChatHistoryItem = {
  content?: string;
  isUser?: boolean;
};

type SchemaColumn = {
  table_name?: string;
  column_name?: string;
  data_type?: string;
  is_nullable?: string;
};

type SchemaLike = {
  tables?: SchemaColumn[];
  foreignKeys?: unknown[];
};

type TableRef = {
  table: string;
  alias: string;
};

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

type AssistantPayload = {
  response: string;
  explanation: string;
  message: string;
  sql: string | null;
  result: any[] | null;
  visualization: string;
  actions: BotAction[];
  action: BotAction | null;
  insights: string[];
  detectedLang: "ur" | "en";
  chatLogId: string | null;
  isClarification?: boolean;
  meta?: Record<string, unknown>;
};

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
        "AI model not found. Update the model name in Settings, for example gemini-1.5-flash.",
      errorType: "MODEL_NOT_FOUND",
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

function buildAssistantPayload(args: {
  explanation: string;
  sql?: string | null;
  result?: any[] | null;
  visualization?: string;
  actions?: BotAction[];
  insights?: string[];
  detectedLang: "ur" | "en";
  chatLogId?: string | null;
  isClarification?: boolean;
  meta?: Record<string, unknown>;
}): AssistantPayload {
  const actions = args.actions || [];
  return {
    response: args.explanation,
    explanation: args.explanation,
    message: args.explanation,
    sql: args.sql ?? null,
    result: args.result ?? null,
    visualization: args.visualization || "none",
    actions,
    action: actions[0] || null,
    insights: args.insights || [],
    detectedLang: args.detectedLang,
    chatLogId: args.chatLogId ?? null,
    ...(args.isClarification ? { isClarification: true } : {}),
    ...(args.meta ? { meta: args.meta } : {}),
  };
}

function errorResponse(
  message: string,
  errorType: string,
  status = 500,
  extras: Partial<AssistantPayload> = {},
) {
  const actions = extras.actions || [];
  return Response.json(
    {
      error: message,
      errorType,
      response: message,
      explanation: message,
      message,
      actions,
      action: actions[0] || null,
      sql: extras.sql ?? null,
      result: extras.result ?? null,
      visualization: extras.visualization || "none",
      insights: extras.insights || [],
      detectedLang: extras.detectedLang,
      chatLogId: extras.chatLogId ?? null,
      ...(extras.meta ? { meta: extras.meta } : {}),
    },
    { status, headers: CORS },
  );
}

function serialize(result: any[]) {
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

const SENSITIVE_COLUMN_PATTERNS = [
  /password/i,
  /passcode/i,
  /secret/i,
  /token/i,
  /api[_-]?key/i,
  /access[_-]?key/i,
  /refresh[_-]?key/i,
  /private[_-]?key/i,
  /hash/i,
  /salt/i,
  /otp/i,
  /mfa/i,
  /ssn/i,
  /social[_-]?security/i,
  /card[_-]?number/i,
  /cvv/i,
  /connection[_-]?string/i,
  /database[_-]?url/i,
];

function isSensitiveColumn(column: string) {
  return SENSITIVE_COLUMN_PATTERNS.some((pattern) => pattern.test(column));
}

function redactSensitiveFields(result: any[]): any[] {
  return result.map((row) => {
    const safeRow: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(row)) {
      if (!isSensitiveColumn(key)) safeRow[key] = value;
    }
    return safeRow;
  });
}

function filterSmartResult(result: any[]): any[] {
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
      const seen = new Map<string, any>();
      filtered.forEach((row) => {
        const name = String(row[nameKey]).toLowerCase().trim();
        const price = Number(row[priceKey]) || 0;
        if (!seen.has(name) || price > Number(seen.get(name)[priceKey])) {
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

function detectViz(result: any[], question: string): string {
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

function pivotStacked(result: any[]) {
  if (!result.length || !("category" in result[0])) return result;

  const map: Record<string, Record<string, unknown>> = {};
  result.forEach((row) => {
    if (!map[row.month]) {
      map[row.month] = {
        month: new Date(row.month).toLocaleString("default", {
          month: "short",
          year: "numeric",
        }),
      };
    }
    map[row.month][row.category] = Number(row.total_amount);
  });
  return Object.values(map);
}

function getInsights(result: any[]) {
  if (!result?.length || result.length < 2) return [];

  const keys = Object.keys(result[0]);
  const numKey = keys.find((key) => typeof result[0][key] === "number");
  const labelKey = keys.find((key) => typeof result[0][key] !== "number");
  if (!numKey || !labelKey) return [];

  const sorted = [...result].sort((a, b) => b[numKey] - a[numKey]);
  return [
    `${sorted[0][labelKey]} has the highest value (${Number(sorted[0][numKey]).toLocaleString()}).`,
    `${sorted[sorted.length - 1][labelKey]} has the lowest value (${Number(sorted[sorted.length - 1][numKey]).toLocaleString()}).`,
  ];
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

function isSafeRouteHref(value: unknown): value is string {
  const href = normalizeValue(value);
  return (
    href.startsWith("/dashboard") &&
    !href.includes("\n") &&
    !href.includes("\r") &&
    !href.toLowerCase().startsWith("javascript:")
  );
}

function sanitizeRouteMap(routeMap: Record<string, string> | undefined) {
  const safe: Record<string, string> = {};
  if (!routeMap || typeof routeMap !== "object") return safe;

  for (const [key, href] of Object.entries(routeMap)) {
    if (isSafeRouteHref(href)) safe[key] = href;
  }
  return safe;
}

function normalizeValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function getNestedValue(source: unknown, path: string[]): string {
  let current = source;
  for (const key of path) {
    if (!current || typeof current !== "object") return "";
    current = (current as Record<string, unknown>)[key];
  }
  return normalizeValue(current);
}

function firstValue(...values: unknown[]): string {
  for (const value of values) {
    const normalized = normalizeValue(value);
    if (normalized) return normalized;
  }
  return "";
}

function normalizeWidgetMode(value: unknown): WidgetMode {
  const mode = normalizeValue(value).toLowerCase().replace(/[_\s]+/g, "-");
  if (["erp", "erp-dashboard", "erp-widget", "dashboard"].includes(mode)) {
    return "erp";
  }
  return "general";
}

function normalizeScopeMode(value: unknown): ScopeMode {
  const mode = normalizeValue(value).toLowerCase();
  if (["database", "tenant", "user", "hybrid", "auto"].includes(mode)) {
    return mode as ScopeMode;
  }
  return "auto";
}

function escapeSqlLiteral(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

function isLikelySafeScopeValue(value: string): boolean {
  return !!value && value.length <= 160 && !/[\r\n;\0]/.test(value);
}

function isSafeIdentifier(value: string): boolean {
  return /^[a-z_][a-z0-9_]*$/i.test(value);
}

function quoteIdentifier(value: string): string {
  if (isSafeIdentifier(value)) return value;
  return `"${value.replace(/"/g, '""')}"`;
}

function normalizeIdentifier(value: string): string {
  return value.replace(/"/g, "").split(".").pop()?.toLowerCase() || "";
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getSchemaColumns(schema: SchemaLike): Map<string, string> {
  const columns = Array.isArray(schema?.tables) ? schema.tables : [];
  const result = new Map<string, string>();
  for (const column of columns) {
    const name = normalizeValue(column?.column_name);
    if (name) result.set(name.toLowerCase(), name);
  }
  return result;
}

function getTableColumns(schema: SchemaLike): Map<string, Set<string>> {
  const tableColumns = new Map<string, Set<string>>();
  for (const column of schema.tables || []) {
    const tableName = normalizeValue(column.table_name).toLowerCase();
    const columnName = normalizeValue(column.column_name).toLowerCase();
    if (!tableName || !columnName) continue;
    if (!tableColumns.has(tableName)) tableColumns.set(tableName, new Set());
    tableColumns.get(tableName)!.add(columnName);
  }
  return tableColumns;
}

function findMatchingColumn(
  schema: SchemaLike,
  configuredColumn: string | undefined,
  candidates: string[],
): string | null {
  const columns = getSchemaColumns(schema);
  const configured = configuredColumn?.trim();
  if (configured) {
    if (!isSafeIdentifier(configured)) return null;
    return columns.get(configured.toLowerCase()) || null;
  }

  for (const candidate of candidates) {
    const found = columns.get(candidate.toLowerCase());
    if (found) return found;
  }
  return null;
}

function buildScopeFilters(args: {
  schema: SchemaLike;
  context: AppContextConfig;
  tenantId: string;
  userId: string;
}) {
  const mode = normalizeScopeMode(args.context.dataScope?.mode);
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
  const missing: string[] = [];

  if (mode === "database") {
    return { mode, filters, tenantColumn, userColumn, missing };
  }

  if (
    ["tenant", "hybrid"].includes(mode) &&
    (!args.tenantId || !tenantColumn || !isLikelySafeScopeValue(args.tenantId))
  ) {
    missing.push(
      !args.tenantId
        ? "tenant id"
        : !tenantColumn
          ? "tenant scope column"
          : "safe tenant id",
    );
  }

  if (
    ["user", "hybrid"].includes(mode) &&
    (!args.userId || !userColumn || !isLikelySafeScopeValue(args.userId))
  ) {
    missing.push(
      !args.userId
        ? "user id"
        : !userColumn
          ? "user scope column"
          : "safe user id",
    );
  }

  if (
    ["auto", "tenant", "hybrid"].includes(mode) &&
    args.tenantId &&
    tenantColumn &&
    isLikelySafeScopeValue(args.tenantId)
  ) {
    filters.push({ kind: "tenant", column: tenantColumn, value: args.tenantId });
  }

  if (
    ["user", "hybrid"].includes(mode) &&
    args.userId &&
    userColumn &&
    isLikelySafeScopeValue(args.userId)
  ) {
    filters.push({ kind: "user", column: userColumn, value: args.userId });
  }

  if (
    mode === "auto" &&
    filters.length === 0 &&
    args.userId &&
    userColumn &&
    isLikelySafeScopeValue(args.userId)
  ) {
    filters.push({ kind: "user", column: userColumn, value: args.userId });
  }

  return { mode, filters, tenantColumn, userColumn, missing };
}

function extractTableRefs(sql: string): TableRef[] {
  const refs: TableRef[] = [];
  const re =
    /\b(?:FROM|JOIN)\s+((?:"?[a-zA-Z_][\w]*"?\.)?"?[a-zA-Z_][\w]*"?)(?:\s+(?:AS\s+)?("?[a-zA-Z_][\w]*"?))?/gi;
  const reserved = new Set([
    "where",
    "join",
    "left",
    "right",
    "inner",
    "outer",
    "full",
    "cross",
    "on",
    "group",
    "order",
    "limit",
    "having",
    "union",
  ]);

  for (const match of sql.matchAll(re)) {
    const table = normalizeIdentifier(match[1]);
    const alias = normalizeIdentifier(match[2] || table);
    if (!table || reserved.has(table)) continue;
    refs.push({ table, alias: reserved.has(alias) ? table : alias });
  }

  return refs;
}

function identifierPattern(value: string) {
  return `"?${escapeRegExp(value)}"?`;
}

function hasExactScopePredicate(sql: string, ref: TableRef, filter: ScopeFilter) {
  const alias = identifierPattern(ref.alias);
  const table = identifierPattern(ref.table);
  const column = identifierPattern(filter.column);
  const literal = escapeRegExp(filter.value.replace(/'/g, "''"));
  return new RegExp(
    `(?:\\b${alias}\\s*\\.\\s*|\\b${table}\\s*\\.\\s*)?\\b${column}\\b\\s*=\\s*'${literal}'`,
    "i",
  ).test(sql);
}

function insertWhereCondition(sql: string, condition: string): string {
  if (/\bWHERE\b/i.test(sql)) {
    return sql.replace(/\bWHERE\b/i, `WHERE ${condition} AND `);
  }

  for (const keyword of ["GROUP BY", "HAVING", "ORDER BY", "LIMIT", "OFFSET"]) {
    const re = new RegExp(`\\b${keyword}\\b`, "i");
    if (re.test(sql)) {
      return sql.replace(re, `WHERE ${condition} ${keyword}`);
    }
  }

  return sql.replace(/;?\s*$/, ` WHERE ${condition}`);
}

function buildScopeConditions(
  sql: string,
  schema: SchemaLike,
  filters: ScopeFilter[],
) {
  const tableColumns = getTableColumns(schema);
  const refs = extractTableRefs(sql);
  const conditions: string[] = [];

  for (const filter of filters) {
    const matchingRefs = refs.filter((ref) =>
      tableColumns.get(ref.table)?.has(filter.column.toLowerCase()),
    );

    for (const ref of matchingRefs) {
      if (hasExactScopePredicate(sql, ref, filter)) continue;
      conditions.push(
        `${quoteIdentifier(ref.alias || ref.table)}.${quoteIdentifier(
          filter.column,
        )} = ${escapeSqlLiteral(filter.value)}`,
      );
    }
  }

  return [...new Set(conditions)];
}

function injectScopeFilters(
  sql: string,
  schema: SchemaLike,
  filters: ScopeFilter[],
): string {
  const conditions = buildScopeConditions(sql, schema, filters);
  if (!conditions.length) return sql;
  return insertWhereCondition(sql, conditions.join(" AND "));
}

function ensureSafetyLimit(sql: string, maxRows = 100): string {
  if (/\bLIMIT\s+\d+\b/i.test(sql)) return sql;
  if (!/\bFROM\b/i.test(sql)) return sql;
  if (/\bOFFSET\b/i.test(sql)) {
    return sql.replace(/\bOFFSET\b/i, `LIMIT ${maxRows} OFFSET`);
  }
  return sql.replace(/;?\s*$/, ` LIMIT ${maxRows}`);
}

function getFieldValue(
  row: Record<string, any>,
  candidates: readonly string[],
): any {
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
  row: Record<string, any>,
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
  result: any[],
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

  const row = result[0] as Record<string, any>;
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

function isNavigationIntent(question: string) {
  return /\b(open|go to|show|take me to|navigate|launch|view)\b/i.test(
    question,
  );
}

function isSimpleNavigationRequest(question: string) {
  const q = question.toLowerCase();
  if (!isNavigationIntent(q)) return false;

  const dataIntent =
    /\b(total|count|how many|which|who|what|where|find|search|details|detail|low|pending|overdue|unpaid|paid|due|today|yesterday|tomorrow|week|month|year|top|best|worst|revenue|profit|balance|stock|quantity|with|for|by|from|between)\b/i;
  if (dataIntent.test(q)) return false;

  const wordCount = q.split(/\s+/).filter(Boolean).length;
  return wordCount <= 6 || /\b(page|screen|module|section)\b/i.test(q);
}

function getDashboardPathFromText(text: string): string | null {
  const match = text.match(/\/dashboard\/[a-z0-9/_-]*/i) || text.match(/\/dashboard\b/i);
  return match ? match[0] : null;
}

function getLocalNavigationAction(
  question: string,
  routeMap: Record<string, string>,
): BotAction | null {
  const q = question.toLowerCase();
  const explicitPath = getDashboardPathFromText(question);
  if (explicitPath) {
    return { type: "navigate", href: explicitPath, label: "Open page" };
  }

  if (!isSimpleNavigationRequest(q)) return null;

  const candidates: Array<{ route: string; label: string; words: string[] }> = [
    { route: "dashboard", label: "Open dashboard", words: ["dashboard", "home"] },
    { route: "inventory", label: "Open inventory", words: ["inventory", "stock"] },
    { route: "products", label: "Open products", words: ["product", "products"] },
    { route: "customers", label: "Open customers", words: ["customer", "customers", "client", "clients"] },
    { route: "sales", label: "Open sales", words: ["sale", "sales"] },
    { route: "purchases", label: "Open purchases", words: ["purchase", "purchases"] },
    { route: "tasks", label: "Open tasks", words: ["task", "tasks"] },
    { route: "reports", label: "Open reports", words: ["report", "reports"] },
    { route: "invoices", label: "Open invoices", words: ["invoice", "invoices", "bill", "bills"] },
    { route: "staff", label: "Open staff", words: ["staff", "employee", "employees"] },
    { route: "teams", label: "Open teams", words: ["team", "teams"] },
    { route: "settings", label: "Open settings", words: ["setting", "settings"] },
  ];

  const match = candidates.find((candidate) =>
    candidate.words.some((word) => q.includes(word)),
  );

  if (!match || !routeMap[match.route]) return null;
  return { type: "navigate", href: routeMap[match.route], label: match.label };
}

function getHelpResponse(question: string, widgetMode: WidgetMode): string | null {
  if (!/\b(help|hello|hi|salam|what can you do|how can you help)\b/i.test(question)) {
    return null;
  }

  if (widgetMode === "erp") {
    return "I can help with safe read-only ERP questions, summaries, and navigation. Try asking about invoices, products, customers, stock, staff, tasks, or reports with a date, status, name, or code when possible.";
  }

  return "I can answer read-only questions about your connected database, summarize results, and show charts when the data fits.";
}

function isUnableToQueryResult(result: any[]) {
  return (
    result.length === 1 &&
    typeof result[0]?.error === "string" &&
    result[0].error.toUpperCase() === "UNABLE_TO_QUERY"
  );
}

export async function POST(req: Request) {
  try {
    return await handlePost(req);
  } catch (error) {
    console.error("Unhandled AI route error:", error);
    return errorResponse(
      "The bot server hit an unexpected error before it could complete the request. Please try again, and check the hosted bot logs if it repeats.",
      "SERVER_ERROR",
      500,
    );
  }
}

async function handlePost(req: Request) {
  const apiKey =
    req.headers.get("x-api-key") || req.headers.get("X-API-Key") || "";

  if (!apiKey) {
    return errorResponse("API key required.", "NO_API_KEY", 401);
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return errorResponse("Invalid JSON body.", "INVALID_JSON", 400);
  }

  const question = normalizeValue(body?.question);
  const preferredLang = body?.preferredLang;
  const chatHistory = Array.isArray(body?.chatHistory)
    ? (body.chatHistory as ChatHistoryItem[])
    : [];
  const erpContext =
    body?.erpContext && typeof body.erpContext === "object" ? body.erpContext : {};
  const tenantId = firstValue(
    body?.tenant_id,
    body?.tenantId,
    body?.company_id,
    body?.companyId,
    getNestedValue(erpContext, ["tenantId"]),
    getNestedValue(erpContext, ["tenant_id"]),
    getNestedValue(erpContext, ["companyId"]),
    getNestedValue(erpContext, ["company_id"]),
    getNestedValue(body, ["tenant", "id"]),
    getNestedValue(body, ["company", "id"]),
    getNestedValue(body, ["metadata", "tenantId"]),
    getNestedValue(body, ["metadata", "companyId"]),
    req.headers.get("x-company-id"),
    req.headers.get("x-tenant-id"),
  );
  const userId = firstValue(
    body?.userId,
    body?.user_id,
    getNestedValue(erpContext, ["userId"]),
    getNestedValue(erpContext, ["user_id"]),
    getNestedValue(body, ["user", "id"]),
    getNestedValue(body, ["metadata", "userId"]),
    req.headers.get("x-user-id"),
  );
  const userEmail = firstValue(
    body?.userEmail,
    body?.user_email,
    getNestedValue(erpContext, ["userEmail"]),
    getNestedValue(erpContext, ["user_email"]),
    getNestedValue(body, ["user", "email"]),
    getNestedValue(body, ["metadata", "userEmail"]),
    req.headers.get("x-user-email"),
  );
  const widgetModeFromRequest = firstValue(
    body?.widgetMode,
    getNestedValue(erpContext, ["widgetMode"]),
    getNestedValue(body, ["metadata", "widgetMode"]),
    req.headers.get("x-widget-mode"),
  );
  const currentPage =
    firstValue(
      body?.currentPage,
      body?.currentPath,
      getNestedValue(erpContext, ["currentPage"]),
      getNestedValue(erpContext, ["currentPath"]),
      getNestedValue(body, ["metadata", "currentPath"]),
    );

  if (!question) {
    return errorResponse("Question is required.", "QUESTION_REQUIRED", 400);
  }

  const app = await prisma.connectedApp.findUnique({
    where: { apiKey },
    select: {
      id: true,
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
    return errorResponse("Invalid or inactive API key.", "INVALID_API_KEY", 401);
  }

  if (!app.dbUrl) {
    return errorResponse("No database URL. Add it in Settings.", "NO_DB", 400);
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
    type: providerType as any,
  });

  const appContext = parseAppContext(app.contextJson);
  const widgetMode =
    normalizeWidgetMode(widgetModeFromRequest) === "erp" ||
    normalizeWidgetMode(appContext.widgetMode) === "erp"
      ? "erp"
      : "general";
  const routeMap = {
    ...DEFAULT_ROUTE_MAP,
    ...sanitizeRouteMap(appContext.routeMap),
  };

  const helpResponse = getHelpResponse(question, widgetMode);
  if (helpResponse) {
    return Response.json(
      buildAssistantPayload({
        explanation: helpResponse,
        detectedLang,
      }),
      { headers: CORS },
    );
  }

  if (widgetMode === "erp") {
    const localAction = getLocalNavigationAction(question, routeMap);
    if (localAction) {
      return Response.json(
        buildAssistantPayload({
          explanation: "Opening that ERP page.",
          actions: [localAction],
          detectedLang,
          meta: { handledLocally: true },
        }),
        { headers: CORS },
      );
    }
  }

  let schema: SchemaLike = {};
  try {
    schema = await getAppSchema(app.id);
    if (!Array.isArray(schema.tables) || schema.tables.length === 0) {
      throw new Error("No schema tables found");
    }
  } catch {
    return errorResponse(
      "I could not read this app's database schema yet. Rebuild the schema in Connected Apps, then try again.",
      "SCHEMA_UNAVAILABLE",
      503,
      { detectedLang },
    );
  }

  // Build scope filters from app settings and the discovered schema.
  const scope = buildScopeFilters({
    schema,
    context: appContext,
    tenantId,
    userId,
  });

  if (widgetMode === "erp" && scope.missing.length > 0) {
    return errorResponse(
      `The ERP bot needs ${scope.missing.join(
        " and ",
      )} before it can answer safely. Pass tenant/user context from the ERP session or update the connected app scope settings.`,
      "MISSING_SCOPE_CONTEXT",
      400,
      {
        detectedLang,
        meta: {
          scopeMode: scope.mode,
          tenantColumn: scope.tenantColumn,
          userColumn: scope.userColumn,
        },
      },
    );
  }

  const clarify = needsClarification(question, detectedLang);
  if (clarify) {
    return Response.json(
      buildAssistantPayload({
        explanation: clarify,
        isClarification: true,
        sql: null,
        result: null,
        visualization: "none",
        actions: [],
        insights: [],
        detectedLang,
        chatLogId: null,
      }),
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
    scope.filters.length > 0
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

  const schemaWithHint = {
    ...schema,
    _hint:
      `${scopeHint} ` +
      "Exclude soft-deleted records when name is prefixed with [DELETED]. Use DISTINCT to avoid duplicates. Never select password, token, secret, key, hash, OTP, session, or connection-string columns.",
  };

  const prompt = `${promptPrefix}\n${scopeHint}\nUser ID: ${
    userId || "unknown"
  }\nUser Email: ${userEmail || "unknown"}\nCurrent ERP page: ${
    currentPage || "unknown"
  }\n\n${contextPrompt}`.trim();

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
  } catch (err: any) {
    const fe = friendlyError(err.message);
    return errorResponse(fe.message, fe.errorType, 500, { detectedLang });
  }

  if (scope.filters.length) {
    sql = injectScopeFilters(sql, schema, scope.filters);
  }

  sql = ensureSafetyLimit(sql);

  if (!isSafeSQL(sql)) {
    return errorResponse("Unsafe SQL blocked.", "UNSAFE_SQL", 400, {
      detectedLang,
    });
  }

  const userPrisma = new PrismaClient({
    datasources: { db: { url: app.dbUrl } },
  });

  try {
    const rawResult = (await userPrisma.$queryRawUnsafe(sql)) as any[];
    let result = serialize(rawResult);
    if (isUnableToQueryResult(result)) {
      return Response.json(
        buildAssistantPayload({
          explanation:
            "I could not answer that safely from the available database schema. Try adding a specific module, date range, status, name, or code.",
          sql,
          result: [],
          visualization: "none",
          actions: widgetMode === "erp" ? buildErpActions(question, [], routeMap) : [],
          detectedLang,
        }),
        { headers: CORS },
      );
    }
    result = redactSensitiveFields(result);
    result = filterSmartResult(result);
    const visualization = detectViz(result, question);
    if (visualization === "stacked") result = pivotStacked(result);

    let explanation =
      detectedLang === "ur"
        ? `${result.length} نتائج ملے۔`
        : `Found ${result.length} result(s).`;

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

    const actions =
      widgetMode === "erp"
        ? buildErpActions(question, result, routeMap)
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
      buildAssistantPayload({
        explanation,
        sql,
        result,
        visualization,
        actions,
        insights: getInsights(result),
        detectedLang,
        chatLogId: log?.id,
      }),
      { headers: CORS },
    );
  } catch (err: any) {
    try {
      const rawFixed = await provider.fixSQL(
        sql,
        err.message,
        JSON.stringify(schemaWithHint),
        aiApiKey,
        aiBaseUrl,
        aiModel,
      );

      let fixedSql = cleanSQL(rawFixed);
      if (scope.filters.length) {
        fixedSql = injectScopeFilters(fixedSql, schema, scope.filters);
      }
      fixedSql = ensureSafetyLimit(fixedSql);

      if (!isSafeSQL(fixedSql)) throw new Error("Fixed SQL unsafe");

      const rawResult = (await userPrisma.$queryRawUnsafe(fixedSql)) as any[];
      let result = serialize(rawResult);
      if (isUnableToQueryResult(result)) {
        return Response.json(
          buildAssistantPayload({
            explanation:
              "I could not answer that safely from the available database schema. Try adding a specific module, date range, status, name, or code.",
            sql: fixedSql,
            result: [],
            visualization: "none",
            actions:
              widgetMode === "erp" ? buildErpActions(question, [], routeMap) : [],
            detectedLang,
          }),
          { headers: CORS },
        );
      }
      result = redactSensitiveFields(result);
      result = filterSmartResult(result);
      const visualization = detectViz(result, question);
      if (visualization === "stacked") result = pivotStacked(result);

      let explanation =
        detectedLang === "ur"
          ? `${result.length} نتائج ملے۔`
          : `Found ${result.length} result(s).`;

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

      const actions =
        widgetMode === "erp"
          ? buildErpActions(question, result, routeMap)
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
        buildAssistantPayload({
          explanation,
          sql: fixedSql,
          result,
          visualization,
          actions,
          insights: getInsights(result),
          detectedLang,
          chatLogId: log?.id,
        }),
        { headers: CORS },
      );
    } catch (fixErr: any) {
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

      const fe = friendlyError(fixErr.message);
      return errorResponse(fe.message, fe.errorType, 500, { detectedLang });
    }
  } finally {
    await userPrisma.$disconnect();
  }
}
