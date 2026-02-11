import { askGemini } from "@/lib/gemini";
import { prisma } from "@/lib/prisma";
import { isSafeSQL } from "@/lib/sql-guard";
import { loadOrCreateSchema } from "@/lib/memory/schema-loader";

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

function buildExplanation(result: any[], question: string) {
  if (!result || result.length === 0) {
    return "No matching records were found.";
  }

  return "Here is the analysis based on your live database.";
}

export async function POST(req: Request) {
  const apiKey = req.headers.get("x-mcp-key");
  if (apiKey !== process.env.MCP_API_KEY) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { question } = await req.json();
  const schema = await loadOrCreateSchema();

  const prompt = `
You are an MCP database analytics agent.

Known database schema:
${JSON.stringify(schema)}

Return ONLY valid JSON:

{
  "sql": "PostgreSQL SELECT query",
  "visualization": "kpi | table | bar | pie | line"
}

Rules:
- SQL must be SELECT only
- No markdown
- No explanation
- Single numeric result → kpi
- Grouped by date → line
- Grouped by category small set → pie
- Grouped by category large set → bar
- Raw rows → table

User request:
${question}
`;

  const aiRaw = await askGemini(prompt);

  let parsed;
  try {
    parsed = JSON.parse(aiRaw);
  } catch {
    return Response.json({ error: "AI returned invalid JSON" }, { status: 500 });
  }

  const sql = parsed.sql?.trim();
  const visualization = parsed.visualization;

  if (!isSafeSQL(sql)) {
    return Response.json({ error: "Unsafe SQL blocked" }, { status: 400 });
  }

  try {
    const raw = await prisma.$queryRawUnsafe(sql) as any[];
    const result = serializeResult(raw);

    return Response.json({
      explanation: buildExplanation(result, question),
      sql,
      result,
      visualization,
    });
  } catch (err: any) {
    return Response.json(
      { error: "Database query failed", details: err.message },
      { status: 500 }
    );
  }
}
