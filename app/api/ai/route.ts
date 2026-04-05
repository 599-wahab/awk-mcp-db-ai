// app/api/ai/route.ts
import { prisma } from "@/lib/prisma";
import { isSafeSQL } from "@/lib/sql-guard";
import { getAppSchema } from "@/lib/memory/schema-loader";
import { askGeminiForSQL, askGeminiForExplanation } from "@/lib/gemini";
import { PrismaClient } from "@prisma/client";

function serializeResult(result: any[]) {
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

function detectVisualization(result: any[], question: string) {
  if (!result?.length) return "none";
  const q = question.toLowerCase();
  if (q.includes("stacked") || q.includes("اسٹیکڈ")) return "stacked";
  if (q.includes("pie") || q.includes("پائی")) return "pie";
  if (q.includes("bar") || q.includes("بار")) return "bar";
  if (q.includes("line") || q.includes("trend") || q.includes("رجحان")) return "line";
  const numericKeys = Object.keys(result[0]).filter((k) => typeof result[0][k] === "number");
  if (result.length === 1 && numericKeys.length === 1) return "kpi";
  if (result.length > 1 && numericKeys.length >= 1) return "line";
  return "table";
}

function pivotForStacked(result: any[]) {
  if (!result.length || !("category" in result[0])) return result;
  const map: any = {};
  result.forEach((row) => {
    if (!map[row.month]) {
      map[row.month] = {
        month: new Date(row.month).toLocaleString("default", { month: "short", year: "numeric" }),
      };
    }
    map[row.month][row.category] = Number(row.total_amount);
  });
  return Object.values(map);
}

function generateInsights(result: any[]) {
  if (!result?.length || result.length < 2) return [];
  const keys = Object.keys(result[0]);
  const numKey = keys.find((k) => typeof result[0][k] === "number");
  const labelKey = keys.find((k) => typeof result[0][k] !== "number");
  if (!numKey || !labelKey) return [];
  const sorted = [...result].sort((a, b) => b[numKey] - a[numKey]);
  return [
    `${sorted[0][labelKey]} has the highest value (${Number(sorted[0][numKey]).toLocaleString()}).`,
    `${sorted[sorted.length - 1][labelKey]} has the lowest value (${Number(sorted[sorted.length - 1][numKey]).toLocaleString()}).`,
  ];
}

export async function OPTIONS() {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, x-api-key",
    },
  });
}

export async function POST(req: Request) {
  // CORS headers for cross-origin widget requests
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, x-api-key",
  };

  const apiKey = req.headers.get("x-api-key");
  if (!apiKey) {
    return Response.json({ error: "API key required" }, { status: 401, headers: corsHeaders });
  }

  // Look up the app by API key
  const app = await prisma.connectedApp.findUnique({
    where: { apiKey },
  });

  if (!app || !app.isActive) {
    return Response.json({ error: "Invalid or inactive API key" }, { status: 401, headers: corsHeaders });
  }

  if (!app.dbUrl) {
    return Response.json(
      { error: "No database connected. Please add your DB URL in settings." },
      { status: 400, headers: corsHeaders }
    );
  }

  const { question } = await req.json();
  if (!question?.trim()) {
    return Response.json({ error: "Question is required" }, { status: 400, headers: corsHeaders });
  }

  // Load schema memory
  let schema: object;
  try {
    schema = await getAppSchema(app.id);
  } catch {
    schema = {};
  }

  const schemaStr = JSON.stringify(schema);

  // Generate SQL
  let sql: string;
  try {
    sql = await askGeminiForSQL(question, schemaStr);
  } catch (err: any) {
    return Response.json({ error: "AI failed to generate SQL", details: err.message }, { status: 500, headers: corsHeaders });
  }

  if (!isSafeSQL(sql)) {
    return Response.json({ error: "Unsafe SQL blocked" }, { status: 400, headers: corsHeaders });
  }

  // Run SQL on user's database
  const userPrisma = new PrismaClient({ datasources: { db: { url: app.dbUrl } } });

  try {
    const raw = await userPrisma.$queryRawUnsafe(sql) as any[];
    let result = serializeResult(raw);
    const visualization = detectVisualization(result, question);
    if (visualization === "stacked") result = pivotForStacked(result);

    const explanation = await askGeminiForExplanation(question, result);

    // Log chat
    await prisma.chatLog.create({
      data: {
        appId: app.id,
        question,
        generatedSql: sql,
        result: JSON.stringify(result),
        explanation,
        wasSuccessful: true,
      },
    });

    // Update stats
    await prisma.connectedApp.update({
      where: { id: app.id },
      data: { totalChats: { increment: 1 }, lastActiveAt: new Date() },
    });

    return Response.json(
      { explanation, sql, result, visualization, insights: generateInsights(result) },
      { headers: corsHeaders }
    );
  } catch (err: any) {
    // Auto-fix attempt
    try {
      const fixedSql = await askGeminiForSQL(
        `Fix this failing SQL:\n${sql}\nError: ${err.message}\n\nReturn only the corrected SELECT SQL.`,
        schemaStr
      );
      if (!isSafeSQL(fixedSql)) throw new Error("Fixed SQL is unsafe");

      const raw = await userPrisma.$queryRawUnsafe(fixedSql) as any[];
      let result = serializeResult(raw);
      const visualization = detectVisualization(result, question);
      if (visualization === "stacked") result = pivotForStacked(result);
      const explanation = await askGeminiForExplanation(question, result);

      await prisma.chatLog.create({
        data: { appId: app.id, question, generatedSql: fixedSql, result: JSON.stringify(result), explanation, wasSuccessful: true },
      });
      await prisma.connectedApp.update({
        where: { id: app.id },
        data: { totalChats: { increment: 1 }, lastActiveAt: new Date() },
      });

      return Response.json({ explanation, sql: fixedSql, result, visualization, insights: generateInsights(result) }, { headers: corsHeaders });
    } catch {
      await prisma.chatLog.create({
        data: { appId: app.id, question, generatedSql: sql, wasSuccessful: false },
      });
      return Response.json({ error: "Query failed", details: err.message }, { status: 500, headers: corsHeaders });
    }
  } finally {
    await userPrisma.$disconnect();
  }
}