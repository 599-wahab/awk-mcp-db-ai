// lib/claude.ts
// Replace Gemini with Claude API — supports Urdu + English bilingual responses

const CLAUDE_API_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-sonnet-4-20250514";

export async function askClaude(prompt: string): Promise<string> {
  const res = await fetch(CLAUDE_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1000,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!res.ok) {
    throw new Error(`Claude API error: ${res.status} ${await res.text()}`);
  }

  const data = await res.json();
  const text = data.content?.find((b: any) => b.type === "text")?.text ?? "";
  return text.trim();
}

// Ask Claude to generate SQL — returns clean SQL string only
export async function askClaudeForSQL(
  userQuestion: string,
  schema: object
): Promise<string> {
  const prompt = `You are an enterprise PostgreSQL analytics AI.

Return ONLY valid SELECT SQL. No markdown. No explanation. No comments.

Schema:
${JSON.stringify(schema)}

Rules:
- Always GROUP BY when aggregating
- Always ORDER BY ascending
- Use DATE_TRUNC for time grouping
- For stacked charts → return: month, category, total_amount
- Never use unsafe SQL
- Only SELECT queries allowed

User question (may be in Urdu or English — understand both):
${userQuestion}`;

  const raw = await askClaude(prompt);
  return raw.replace(/```sql/gi, "").replace(/```/g, "").trim();
}

// Ask Claude to explain results in the same language the user asked
export async function askClaudeForExplanation(
  userQuestion: string,
  result: any[]
): Promise<string> {
  const prompt = `You are a helpful bilingual data analyst assistant that speaks both Urdu and English fluently.

The user asked: "${userQuestion}"

The database returned these results:
${JSON.stringify(result.slice(0, 10))}

Instructions:
- Detect the language of the user's question (Urdu or English)
- Respond in the SAME language the user used
- If the question is in Urdu (even Roman Urdu), respond in Urdu
- If in English, respond in English
- Give a short, clear, human-friendly explanation of what the data shows
- Do NOT mention SQL or technical details
- Keep it under 3 sentences`;

  return await askClaude(prompt);
}