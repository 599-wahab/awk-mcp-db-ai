// app/api/ai/route.ts
import { prisma } from "@/lib/prisma";
import { isSafeSQL, cleanSQL } from "@/lib/sql-guard";
import { getAppSchema } from "@/lib/memory/schema-loader";
import { AIProviderFactory } from "@/lib/ai/factory";
import { PrismaClient } from "@prisma/client";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, x-api-key, X-API-Key, x-user-id, X-User-Id, x-user-email, X-User-Email",
  "Access-Control-Max-Age": "86400",
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

// ── Universal tenant filter injection ─────────────────────────────────────────
function injectTenantFilter(sql: string, tenantId: string): string {
  if (sql.toLowerCase().includes("tenant_id")) return sql;

  if (/\bWHERE\b/i.test(sql)) {
    return sql.replace(/\bWHERE\b/i, `WHERE tenant_id = '${tenantId}' AND `);
  }

  for (const keyword of ["GROUP BY", "ORDER BY", "LIMIT", "HAVING"]) {
    const re = new RegExp(`\\b${keyword}\\b`, "i");
    if (re.test(sql)) {
      return sql.replace(re, `WHERE tenant_id = '${tenantId}' ${keyword}`);
    }
  }

  return sql.replace(/;?\s*$/, ` WHERE tenant_id = '${tenantId}'`);
}

function schemaHasTenantId(schema: object): boolean {
  return JSON.stringify(schema).toLowerCase().includes("tenant_id");
}

function friendlyError(msg: string): { message: string; errorType: string } {
  if (msg === "QUOTA_EXCEEDED")
    return {
      message:
        "AI API quota exceeded. Get a new free key from aistudio.google.com and update it in Settings.",
      errorType: "QUOTA_EXCEEDED",
    };
  if (msg === "INVALID_KEY")
    return {
      message: "AI API key is invalid. Check your key in Settings.",
      errorType: "INVALID_KEY",
    };
  if (msg === "NO_KEY")
    return {
      message: "No AI API key. Go to Settings → add your Gemini/OpenAI key.",
      errorType: "NO KEY",
    };
  if (msg === "MODEL_NOT_FOUND")
    return {
      message: "AI model not found. Update model name in Settings.",
      errorType: "MODEL_NOT_FOUND",
    };
  if (msg.includes("ECONNREFUSED"))
    return {
      message:
        "Cannot connect to local AI. Make sure LM Studio or Ollama is running.",
      errorType: "CONNECTION_ERROR",
    };
  return {
    message: "AI error: " + msg.replace("AI_ERROR:", "").slice(0, 100),
    errorType: "AI_ERROR",
  };
}

function detectLang(text: string): "ur" | "en" {
  if (/[\u0600-\u06FF]/.test(text)) return "ur";
  if (
    /\b(kya|hai|hain|aap|mujhe|batao|dikhao|kitne|kitni|kahan|kaun|kaisa|salary|order)\b/i.test(
      text,
    )
  )
    return "ur";
  return "en";
}

function cleanExplanation(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/#{1,6}\s/g, "")
    .replace(/`{1,3}[^`]*`{1,3}/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/^\s*[-*+]\s/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function serialize(result: any[]) {
  return result.map((row) => {
    const obj: any = {};
    for (const [k, v] of Object.entries(row)) {
      if (typeof v === "bigint") obj[k] = Number(v);
      else if (v instanceof Date) obj[k] = v.toISOString();
      else obj[k] = v;
    }
    return obj;
  });
}

function filterSmartResult(result: any[], question: string): any[] {
  if (!result?.length) return result;
  const keys = Object.keys(result[0]);

  const nameKey = keys.find(
    (k) =>
      k.toLowerCase() === "name" ||
      k.toLowerCase() === "item_name" ||
      k.toLowerCase() === "product_name",
  );
  let filtered = result;
  if (nameKey) {
    filtered = filtered.filter((row) => {
      const val = String(row[nameKey] || "");
      return !val.startsWith("[DELETED]") && !val.startsWith("DELETED");
    });
  }

  if (nameKey && filtered.length > 0) {
    const priceKey = keys.find(
      (k) =>
        k.toLowerCase().includes("price") || k.toLowerCase().includes("amount"),
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
  schema: object,
  lang: "ur" | "en",
): string | null {
  const q = question.toLowerCase().trim();

  if (q.split(" ").length <= 2 && !q.includes("?")) {
    if (lang === "ur")
      return "آپ کچھ اور تفصیل دے سکتے ہیں؟ مثلاً کس تاریخ کا ڈیٹا چاہیے، یا کون سی مصنوع/صارف کے بارے میں؟";
    return "Could you be more specific? For example, which date range, product, or customer are you asking about?";
  }

  const hasAll = /\b(all|سب|تمام)\b/.test(q);
  const hasFilter =
    /\b(where|جہاں|جن|filter|date|تاریخ|month|week|year)\b/.test(q);
  if (hasAll && !hasFilter) {
    if (lang === "ur")
      return "کیا آپ سب ریکارڈ دیکھنا چاہتے ہیں؟ بہتر نتیجے کے لیے کوئی فلٹر بتائیں جیسے تاریخ، ماہ، یا صارف کا نام۔";
    return "Do you want all records? For better results, mention a filter like date, month, or a specific name.";
  }

  return null;
}

function detectViz(result: any[], q: string): string {
  if (!result?.length) return "none";
  const ql = q.toLowerCase();
  if (ql.includes("stacked") || ql.includes("اسٹیکڈ")) return "stacked";
  if (ql.includes("pie") || ql.includes("پائی")) return "pie";
  if (ql.includes("bar") || ql.includes("بار")) return "bar";
  if (ql.includes("line") || ql.includes("trend") || ql.includes("رجحان"))
    return "line";
  if (ql.includes("chart") || ql.includes("گراف")) return "bar";

  const keys = Object.keys(result[0]);
  const numKeys = keys.filter((k) => typeof result[0][k] === "number");
  const textKeys = keys.filter((k) => typeof result[0][k] !== "number");
  const isMenuStyle =
    textKeys.length >= 1 && numKeys.length >= 1 && result.length > 3;
  if (isMenuStyle) return "table";
  if (result.length === 1 && numKeys.length === 1) return "kpi";
  if (result.length > 1 && numKeys.length >= 1) return "line";
  return "table";
}

function pivotStacked(result: any[]) {
  if (!result.length || !("category" in result[0])) return result;
  const map: any = {};
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

function getInsights(result: any[], lang: "ur" | "en"): string[] {
  if (!result?.length || result.length < 2) return [];
  const keys = Object.keys(result[0]);
  const numKey = keys.find((k) => typeof result[0][k] === "number");
  const labelKey = keys.find((k) => typeof result[0][k] !== "number");
  if (!numKey || !labelKey) return [];
  const sorted = [...result].sort((a, b) => b[numKey] - a[numKey]);
  if (lang === "ur") {
    return [
      `${sorted[0][labelKey]} کی سب سے زیادہ قدر ہے (${Number(sorted[0][numKey]).toLocaleString()})۔`,
      `${sorted[sorted.length - 1][labelKey]} کی سب سے کم قدر ہے (${Number(sorted[sorted.length - 1][numKey]).toLocaleString()})۔`,
    ];
  }
  return [
    `${sorted[0][labelKey]} has the highest value (${Number(sorted[0][numKey]).toLocaleString()}).`,
    `${sorted[sorted.length - 1][labelKey]} has the lowest value (${Number(sorted[sorted.length - 1][numKey]).toLocaleString()}).`,
  ];
}

export async function POST(req: Request) {
  // ── Read all possible header casing variants ──────────────────────────────
  const apiKey =
    req.headers.get("x-api-key") || req.headers.get("X-API-Key") || "";
  const userId =
    req.headers.get("x-user-id") || req.headers.get("X-User-Id") || "";
  const userEmail =
    req.headers.get("x-user-email") || req.headers.get("X-User-Email") || "";

  if (!apiKey) {
    return Response.json(
      { error: "API key required.", errorType: "NO_API_KEY" },
      { status: 401, headers: CORS },
    );
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
      schemaJson: true,
      schemaBuiltAt: true,
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

  let body: any;
  try {
    body = await req.json();
  } catch {
    return Response.json(
      { error: "Invalid JSON body.", errorType: "BAD_REQUEST" },
      { status: 400, headers: CORS },
    );
  }

  const { question, preferredLang, chatHistory, tenant_id } = body;

  if (!question?.trim()) {
    return Response.json(
      { error: "Question is required.", errorType: "NO_QUESTION" },
      { status: 400, headers: CORS },
    );
  }

  const detectedLang: "ur" | "en" =
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

  let schema: object = {};
  try {
    schema = await getAppSchema(app.id);
  } catch {}

  const hasTenantColumn = schemaHasTenantId(schema);
  const effectiveTenantId =
    tenant_id && hasTenantColumn ? String(tenant_id).trim() : null;
  const isValidUuid = effectiveTenantId
    ? /^[0-9a-f-]{32,36}$/i.test(effectiveTenantId)
    : false;
  const safeTenantId = isValidUuid ? effectiveTenantId : null;

  const clarify = needsClarification(question, schema, detectedLang);
  if (clarify) {
    return Response.json(
      {
        explanation: clarify,
        isClarification: true,
        detectedLang,
        sql: null,
        result: null,
        visualization: "none",
        insights: [],
        chatLogId: null,
      },
      { headers: CORS },
    );
  }

  let contextPrompt = question;
  if (chatHistory?.length) {
    const recent = chatHistory.slice(-4);
    const ctx = recent
      .map((m: any) =>
        m.isUser
          ? `User: ${m.content}`
          : `Assistant result: ${m.content?.slice(0, 100)}`,
      )
      .join("\n");
    contextPrompt = `Previous context:\n${ctx}\n\nCurrent question: ${question}`;
  }

  const schemaWithHint = {
    ...schema,
    _hint: safeTenantId
      ? `IMPORTANT: This is a multi-tenant database. ALWAYS include tenant_id = '${safeTenantId}' in every query. Never return data from other tenants. Also add WHERE name NOT LIKE '[DELETED]%' to exclude soft-deleted records. Use DISTINCT to avoid duplicates.`
      : `IMPORTANT: Exclude soft-deleted records (WHERE name NOT LIKE '[DELETED]%'). Use DISTINCT to avoid duplicates.`,
  };

  const tenantScopedQuestion = safeTenantId
    ? `[Scope ALL queries to tenant_id = '${safeTenantId}'. Never omit this filter.]\n\n${contextPrompt}`
    : contextPrompt;

  let sql: string;
  try {
    const raw = await provider.generateSQL(
      tenantScopedQuestion,
      JSON.stringify(schemaWithHint),
      aiApiKey,
      aiBaseUrl,
      aiModel,
    );
    sql = cleanSQL(raw);
  } catch (err: any) {
    const fe = friendlyError(err.message);
    return Response.json(
      { error: fe.message, errorType: fe.errorType },
      { status: 500, headers: CORS },
    );
  }

  if (safeTenantId) {
    sql = injectTenantFilter(sql, safeTenantId);
  }

  if (!isSafeSQL(sql)) {
    console.error("Unsafe SQL blocked:", sql);
    return Response.json(
      { error: "Unsafe SQL blocked.", errorType: "UNSAFE_SQL" },
      { status: 400, headers: CORS },
    );
  }

  const userPrisma = new PrismaClient({
    datasources: { db: { url: app.dbUrl } },
  });

  const runQuery = async (querySql: string) => {
    const raw2 = (await userPrisma.$queryRawUnsafe(querySql)) as any[];
    let result = serialize(raw2);
    result = filterSmartResult(result, question);
    const viz = detectViz(result, question);
    const final = viz === "stacked" ? pivotStacked(result) : result;
    return { result: final, viz };
  };

  try {
    const { result, viz } = await runQuery(sql);

    let explanation =
      detectedLang === "ur"
        ? `${result.length} نتائج ملے۔`
        : `Found ${result.length} result(s).`;

    try {
      const rawExp = await provider.generateExplanation(
        detectedLang === "ur"
          ? `${question}\n\nجواب اردو میں دیں، صرف 2-3 جملے۔`
          : question,
        result,
        aiApiKey,
        aiBaseUrl,
        aiModel,
      );
      explanation = cleanExplanation(rawExp);
    } catch {}

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
        visualization: viz,
        insights: getInsights(result, detectedLang),
        detectedLang,
        chatLogId: log?.id,
      },
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

      if (safeTenantId) {
        fixedSql = injectTenantFilter(fixedSql, safeTenantId);
      }

      if (!isSafeSQL(fixedSql)) throw new Error("Fixed SQL unsafe");

      const { result, viz } = await runQuery(fixedSql);

      let explanation =
        detectedLang === "ur"
          ? `${result.length} نتائج ملے۔`
          : `Found ${result.length} result(s).`;

      try {
        const rawExp = await provider.generateExplanation(
          detectedLang === "ur"
            ? `${question}\n\nجواب اردو میں دیں، صرف 2-3 جملے۔`
            : question,
          result,
          aiApiKey,
          aiBaseUrl,
          aiModel,
        );
        explanation = cleanExplanation(rawExp);
      } catch {}

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
          visualization: viz,
          insights: getInsights(result, detectedLang),
          detectedLang,
          chatLogId: log?.id,
        },
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
      return Response.json(
        { error: fe.message, errorType: fe.errorType },
        { status: 500, headers: CORS },
      );
    }
  } finally {
    await userPrisma.$disconnect();
  }
}
