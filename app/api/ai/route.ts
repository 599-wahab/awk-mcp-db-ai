// app/api/ai/route.ts
import { prisma } from "@/lib/prisma";
import { isSafeSQL } from "@/lib/sql-guard";
import { getAppSchema } from "@/lib/memory/schema-loader";
import { askGeminiForSQL, askGeminiForExplanation } from "@/lib/gemini";
import { PrismaClient } from "@prisma/client";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, x-api-key",
};

export async function OPTIONS() {
  return new Response(null, { status: 200, headers: CORS });
}

function friendlyError(code: string): string {
  if (code === "QUOTA_EXCEEDED") return "Gemini API quota exceeded. Get a new free key from aistudio.google.com and update it in Settings.";
  if (code === "INVALID_KEY") return "Gemini API key is invalid. Check your key in Settings.";
  if (code === "NO_KEY") return "No Gemini API key found. Add your key in Settings → select your app → paste Gemini key.";
  return code.replace("AI_ERROR:", "AI error: ");
}

function serialize(result: any[]) {
  return result.map(row => {
    const obj: any = {};
    for (const [k, v] of Object.entries(row)) {
      if (typeof v === "bigint") obj[k] = Number(v);
      else if (v instanceof Date) obj[k] = v.toISOString();
      else obj[k] = v;
    }
    return obj;
  });
}

function detectViz(result: any[], q: string) {
  if (!result?.length) return "none";
  const ql = q.toLowerCase();
  if (ql.includes("stacked") || ql.includes("اسٹیکڈ")) return "stacked";
  if (ql.includes("pie") || ql.includes("پائی")) return "pie";
  if (ql.includes("bar") || ql.includes("بار")) return "bar";
  if (ql.includes("line") || ql.includes("trend") || ql.includes("رجحان")) return "line";
  const numKeys = Object.keys(result[0]).filter(k => typeof result[0][k] === "number");
  if (result.length === 1 && numKeys.length === 1) return "kpi";
  if (result.length > 1 && numKeys.length >= 1) return "line";
  return "table";
}

function pivotStacked(result: any[]) {
  if (!result.length || !("category" in result[0])) return result;
  const map: any = {};
  result.forEach(row => {
    if (!map[row.month]) map[row.month] = { month: new Date(row.month).toLocaleString("default", { month: "short", year: "numeric" }) };
    map[row.month][row.category] = Number(row.total_amount);
  });
  return Object.values(map);
}

function getInsights(result: any[]) {
  if (!result?.length || result.length < 2) return [];
  const keys = Object.keys(result[0]);
  const numKey = keys.find(k => typeof result[0][k] === "number");
  const labelKey = keys.find(k => typeof result[0][k] !== "number");
  if (!numKey || !labelKey) return [];
  const sorted = [...result].sort((a, b) => b[numKey] - a[numKey]);
  return [
    `${sorted[0][labelKey]} has the highest value (${Number(sorted[0][numKey]).toLocaleString()}).`,
    `${sorted[sorted.length - 1][labelKey]} has the lowest value (${Number(sorted[sorted.length - 1][numKey]).toLocaleString()}).`,
  ];
}

export async function POST(req: Request) {
  const apiKey = req.headers.get("x-api-key");
  if (!apiKey) return Response.json({ error: "API key required.", errorType: "NO_API_KEY" }, { status: 401, headers: CORS });

  const app = await prisma.connectedApp.findUnique({ where: { apiKey } });
  if (!app || !app.isActive) return Response.json({ error: "Invalid or inactive API key.", errorType: "INVALID_API_KEY" }, { status: 401, headers: CORS });
  if (!app.dbUrl) return Response.json({ error: "No database URL set. Go to Settings and add your database connection string.", errorType: "NO_DB" }, { status: 400, headers: CORS });

  const { question } = await req.json();
  if (!question?.trim()) return Response.json({ error: "Question is required." }, { status: 400, headers: CORS });

  const geminiKey = app.geminiKey || null;
  let schema: object = {};
  try { schema = await getAppSchema(app.id); } catch {}

  let sql: string;
  try {
    sql = await askGeminiForSQL(question, JSON.stringify(schema), geminiKey);
  } catch (err: any) {
    return Response.json({ error: friendlyError(err.message), errorType: err.message }, { status: 500, headers: CORS });
  }

  if (!isSafeSQL(sql)) return Response.json({ error: "Unsafe SQL blocked." }, { status: 400, headers: CORS });

  const userPrisma = new PrismaClient({ datasources: { db: { url: app.dbUrl } } });

  try {
    const raw = await userPrisma.$queryRawUnsafe(sql) as any[];
    let result = serialize(raw);
    const viz = detectViz(result, question);
    if (viz === "stacked") result = pivotStacked(result);

    let explanation = `Found ${result.length} result(s).`;
    try { explanation = await askGeminiForExplanation(question, result, geminiKey); } catch {}

    await prisma.chatLog.create({ data: { appId: app.id, question, generatedSql: sql, result: JSON.stringify(result), explanation, wasSuccessful: true } }).catch(() => {});
    await prisma.connectedApp.update({ where: { id: app.id }, data: { totalChats: { increment: 1 }, lastActiveAt: new Date() } }).catch(() => {});

    return Response.json({ explanation, sql, result, visualization: viz, insights: getInsights(result) }, { headers: CORS });

  } catch (err: any) {
    try {
      const fixedSql = await askGeminiForSQL(`Fix this failing SQL:\n${sql}\nError: ${err.message}\nReturn only corrected SELECT SQL.`, JSON.stringify(schema), geminiKey);
      if (!isSafeSQL(fixedSql)) throw new Error("Fixed SQL unsafe");
      const raw = await userPrisma.$queryRawUnsafe(fixedSql) as any[];
      let result = serialize(raw);
      const viz = detectViz(result, question);
      if (viz === "stacked") result = pivotStacked(result);
      let explanation = `Found ${result.length} result(s).`;
      try { explanation = await askGeminiForExplanation(question, result, geminiKey); } catch {}
      await prisma.chatLog.create({ data: { appId: app.id, question, generatedSql: fixedSql, result: JSON.stringify(result), explanation, wasSuccessful: true } }).catch(() => {});
      await prisma.connectedApp.update({ where: { id: app.id }, data: { totalChats: { increment: 1 }, lastActiveAt: new Date() } }).catch(() => {});
      return Response.json({ explanation, sql: fixedSql, result, visualization: viz, insights: getInsights(result) }, { headers: CORS });
    } catch (fixErr: any) {
      await prisma.chatLog.create({ data: { appId: app.id, question, generatedSql: sql, wasSuccessful: false } }).catch(() => {});
      return Response.json({ error: friendlyError(fixErr.message), errorType: fixErr.message }, { status: 500, headers: CORS });
    }
  } finally {
    await userPrisma.$disconnect();
  }
}