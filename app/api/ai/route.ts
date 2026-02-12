import { askGemini } from "@/lib/gemini";
import { prisma } from "@/lib/prisma";
import { isSafeSQL } from "@/lib/sql-guard";
import { loadOrCreateSchema } from "@/lib/memory/schema-loader";

/* ---------------------- HELPERS ---------------------- */

function serializeResult(result: any[]) {
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

function detectVisualization(result: any[], question: string) {
  if (!result || result.length === 0) return "none";

  const numericKeys = Object.keys(result[0]).filter(
    k => typeof result[0][k] === "number"
  );

  if (result.length === 1 && numericKeys.length === 1) {
    return "kpi";
  }

  if (question.match(/pie/i)) return "pie";
  if (question.match(/bar/i)) return "bar";
  if (question.match(/line|trend/i)) return "line";

  if (result.length > 1 && numericKeys.length >= 1) {
    return "auto-chart";
  }

  return "table";
}

function generateInsights(result: any[]) {
  if (!result || result.length < 2) return [];

  const keys = Object.keys(result[0]);
  const numericKey = keys.find(k => typeof result[0][k] === "number");
  const labelKey = keys.find(k => typeof result[0][k] !== "number");

  if (!numericKey || !labelKey) return [];

  const sorted = [...result].sort(
    (a, b) => b[numericKey] - a[numericKey]
  );

  const highest = sorted[0];
  const lowest = sorted[sorted.length - 1];

  return [
    `${highest[labelKey]} has the highest value (${highest[
      numericKey
    ].toLocaleString()}).`,
    `${lowest[labelKey]} has the lowest value (${lowest[
      numericKey
    ].toLocaleString()}).`,
  ];
}

/* ---------------------- API ---------------------- */

export async function POST(req: Request) {
  const apiKey = req.headers.get("x-mcp-key");
  if (apiKey !== process.env.MCP_API_KEY) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { question } = await req.json();

  const schema = await loadOrCreateSchema();

  const prompt = `
You are a PostgreSQL analytics AI.

Schema:
${JSON.stringify(schema)}

Rules:
- Return ONLY PostgreSQL SELECT
- If user wants chart → GROUP BY something
- Monthly → GROUP BY month
- Daily → GROUP BY date
- Pie → GROUP BY category or payment_method
- Never return markdown

User:
${question}
`;

  let sql = await askGemini(prompt);
  sql = sql.replace(/```sql/gi, "").replace(/```/g, "").trim();

  if (!isSafeSQL(sql)) {
    return Response.json({ error: "Unsafe SQL blocked" }, { status: 400 });
  }

  try {
    const raw = (await prisma.$queryRawUnsafe(sql)) as any[];
    const result = serializeResult(raw);

    const visualization = detectVisualization(result, question);
    const insights = generateInsights(result);

    return Response.json({
      explanation: "Here are your live database results.",
      sql,
      result,
      visualization,
      insights,
    });
  } catch (err: any) {
    return Response.json(
      { error: "Database query failed", details: err.message },
      { status: 500 }
    );
  }
}
