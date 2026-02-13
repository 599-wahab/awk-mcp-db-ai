import { askAI } from "@/lib/ai-router";
import { prisma } from "@/lib/prisma";
import { isSafeSQL } from "@/lib/sql-guard";
import { loadOrCreateSchema } from "@/lib/memory/schema-loader";

/* ---------------------- HELPERS ---------------------- */

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
  if (!result || result.length === 0) return "none";

  const numericKeys = Object.keys(result[0]).filter(
    (k) => typeof result[0][k] === "number"
  );

  if (result.length === 1 && numericKeys.length === 1) {
    return "kpi";
  }

  const q = question.toLowerCase();

  if (q.includes("pie")) return "pie";
  if (q.includes("bar")) return "bar";
  if (q.match(/line|trend|graph|chart/i)) return "line";

  if (result.length > 1 && numericKeys.length >= 1) {
    return "line";
  }

  return "table";
}

function generateInsights(result: any[]) {
  if (!result || result.length < 2) return [];

  const keys = Object.keys(result[0]);
  const numericKey = keys.find((k) => typeof result[0][k] === "number");
  const labelKey = keys.find((k) => typeof result[0][k] !== "number");

  if (!numericKey || !labelKey) return [];

  const sorted = [...result].sort((a, b) => b[numericKey] - a[numericKey]);

  return [
    `Highest: ${sorted[0][labelKey]} (${sorted[0][
      numericKey
    ].toLocaleString()})`,
    `Lowest: ${sorted[sorted.length - 1][labelKey]} (${sorted[
      sorted.length - 1
    ][numericKey].toLocaleString()})`,
  ];
}

function buildExplanation(result: any[], question: string) {
  if (!result || result.length === 0)
    return "No matching records were found.";

  if (question.toLowerCase().includes("today"))
    return "Here is today's total income.";

  if (question.toLowerCase().includes("month"))
    return "Here is your income breakdown by month.";

  if (question.match(/chart|graph|line|bar|pie/i))
    return "Here is the visual breakdown of your data.";

  return "Here are your live database results.";
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

  let provider: string | undefined;
  const q = question.toLowerCase();

  if (q.includes("chatgpt") || q.includes("openai")) {
    provider = "OpenAI";
  } else if (q.includes("deepseek")) {
    provider = "DeepSeek";
  }

  let sql = await askAI(prompt, provider);

  if (!sql || sql.length < 5) {
    return Response.json(
      { error: "AI failed to generate valid SQL." },
      { status: 500 }
    );
  }

  sql = sql.replace(/```sql/gi, "").replace(/```/g, "").trim();

  if (!isSafeSQL(sql)) {
    return Response.json({ error: "Unsafe SQL blocked" }, { status: 400 });
  }

  try {
    const raw = (await prisma.$queryRawUnsafe(sql)) as any[];
    const result = serializeResult(raw);

    return Response.json({
      explanation: buildExplanation(result, question),
      sql,
      result,
      visualization: detectVisualization(result, question),
      insights: generateInsights(result),
    });
  } catch (err: any) {
    return Response.json(
      { error: "Database query failed", details: err.message },
      { status: 500 }
    );
  }
}
