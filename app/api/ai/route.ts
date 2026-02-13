import { askGemini } from "@/lib/gemini";
import { prisma } from "@/lib/prisma";
import { isSafeSQL } from "@/lib/sql-guard";
import { loadOrCreateSchema } from "@/lib/memory/schema-loader";

/* =====================================================
   UTILITIES
===================================================== */

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

function formatMonth(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleString("default", { month: "short", year: "numeric" });
}

function formatCurrency(num: number) {
  return Number(num).toLocaleString();
}

/* =====================================================
   SMART VISUAL DETECTION
===================================================== */

function detectVisualization(result: any[], question: string) {
  if (!result || result.length === 0) return "none";

  const q = question.toLowerCase();

  if (q.includes("stacked")) return "stacked";
  if (q.includes("pie")) return "pie";
  if (q.includes("bar")) return "bar";
  if (q.includes("line") || q.includes("trend")) return "line";

  const numericKeys = Object.keys(result[0]).filter(
    (k) => typeof result[0][k] === "number"
  );

  if (result.length === 1 && numericKeys.length === 1) {
    return "kpi";
  }

  if (result.length > 1 && numericKeys.length >= 1) {
    return "line";
  }

  return "table";
}

/* =====================================================
   STACKED PIVOT ENGINE
===================================================== */

function pivotForStacked(result: any[]) {
  if (!result.length) return result;
  if (!("category" in result[0])) return result;

  const map: any = {};

  result.forEach((row) => {
    const month = row.month;

    if (!map[month]) {
      map[month] = { month: formatMonth(month) };
    }

    map[month][row.category] = Number(row.total_amount);
  });

  return Object.values(map);
}

/* =====================================================
   INSIGHTS + GROWTH
===================================================== */

function generateInsights(result: any[]) {
  if (!result || result.length < 2) return [];

  const keys = Object.keys(result[0]);
  const numericKey = keys.find((k) => typeof result[0][k] === "number");
  const labelKey = keys.find((k) => typeof result[0][k] !== "number");

  if (!numericKey || !labelKey) return [];

  const sorted = [...result].sort((a, b) => b[numericKey] - a[numericKey]);

  const highest = sorted[0];
  const lowest = sorted[sorted.length - 1];

  return [
    `${highest[labelKey]} has the highest value (${formatCurrency(
      highest[numericKey]
    )}).`,
    `${lowest[labelKey]} has the lowest value (${formatCurrency(
      lowest[numericKey]
    )}).`,
  ];
}

function calculateGrowth(result: any[]) {
  if (result.length < 2) return null;

  const numericKey = Object.keys(result[0]).find(
    (k) => typeof result[0][k] === "number"
  );

  if (!numericKey) return null;

  const last = result[result.length - 1][numericKey];
  const prev = result[result.length - 2][numericKey];

  if (!prev) return null;

  const growth = ((last - prev) / prev) * 100;

  return growth.toFixed(2);
}

/* =====================================================
   HUMAN EXPLANATION ENGINE
===================================================== */

function buildExplanation(result: any[], question: string) {
  if (!result.length) return "No matching records were found.";

  const q = question.toLowerCase();

  if (q.includes("stacked")) {
    return "Here is your stacked monthly earnings breakdown by category.";
  }

  if (q.includes("month")) {
    return "Here is your monthly income summary.";
  }

  if (q.includes("today")) {
    return "Here is today's total income.";
  }

  if (q.includes("booking") && q.includes("zain")) {
    return `Yes, ${result.length} booking(s) were found for Zain.`;
  }

  return "Here are your requested results.";
}

/* =====================================================
   MAIN API
===================================================== */

export async function POST(req: Request) {
  const apiKey = req.headers.get("x-mcp-key");

  if (apiKey !== process.env.MCP_API_KEY) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { question } = await req.json();
  const schema = await loadOrCreateSchema();

  const prompt = `
You are an enterprise PostgreSQL analytics AI.

Return ONLY valid SELECT SQL.
No markdown.
No explanation.
No comments.

Schema:
${JSON.stringify(schema)}

Rules:
- Always GROUP BY when aggregating
- Always ORDER BY ascending
- Use DATE_TRUNC for time grouping
- For stacked charts → return: month, category, total_amount
- Use UNION ALL properly aligned
- Never use unsafe SQL
- Only SELECT queries allowed

User question:
${question}
`;

  let sql = await askGemini(prompt);

  sql = sql.replace(/```sql/gi, "").replace(/```/g, "").trim();

  if (!isSafeSQL(sql)) {
    return Response.json({ error: "Unsafe SQL blocked." }, { status: 400 });
  }

  try {
    const raw = (await prisma.$queryRawUnsafe(sql)) as any[];
    let result = serializeResult(raw);

    const visualization = detectVisualization(result, question);

    if (visualization === "stacked") {
      result = pivotForStacked(result);
    }

    const growth = calculateGrowth(result);

    return Response.json({
      explanation: buildExplanation(result, question),
      sql,
      result,
      visualization,
      growth,
      insights: generateInsights(result),
    });
  } catch (err: any) {
    console.warn("Initial query failed. Attempting auto-fix...");

    const fixPrompt = `
The following query failed:

${sql}

Error:
${err.message}

Fix it. Return ONLY corrected SELECT SQL.
`;

    try {
      const fixedSQL = (
        await askGemini(fixPrompt)
      )
        .replace(/```sql/gi, "")
        .replace(/```/g, "")
        .trim();

      if (!isSafeSQL(fixedSQL)) {
        throw new Error("Corrected query unsafe.");
      }

      const raw = (await prisma.$queryRawUnsafe(fixedSQL)) as any[];
      let result = serializeResult(raw);

      const visualization = detectVisualization(result, question);

      if (visualization === "stacked") {
        result = pivotForStacked(result);
      }

      return Response.json({
        explanation: "Query auto-corrected successfully.",
        sql: fixedSQL,
        result,
        visualization,
        insights: generateInsights(result),
      });
    } catch {
      return Response.json(
        { error: "Database query failed.", details: err.message },
        { status: 500 }
      );
    }
  }
}
