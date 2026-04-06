// lib/gemini.ts
import { GoogleGenAI } from "@google/genai";

function getAI(key?: string | null) {
  const apiKey = key || process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("NO_KEY");
  return new GoogleGenAI({ apiKey });
}

function parseGeminiError(err: any): string {
  const msg = err?.message || String(err);

  if (msg.includes("429") || msg.includes("RESOURCE_EXHAUSTED") || msg.includes("quota")) {
    return "QUOTA_EXCEEDED";
  }
  if (msg.includes("API_KEY_INVALID") || msg.includes("invalid api key") || msg.includes("API key not valid")) {
    return "INVALID_KEY";
  }
  if (msg.includes("NO_KEY")) {
    return "NO_KEY";
  }
  return "AI_ERROR:" + msg.slice(0, 100);
}

export async function callGemini(prompt: string, geminiKey?: string | null): Promise<string> {
  // Try gemini-2.0-flash first, fall back to gemini-1.5-flash on quota error
  const models = ["gemini-2.0-flash", "gemini-1.5-flash"];

  for (const model of models) {
    try {
      const ai = getAI(geminiKey);
      const res = await ai.models.generateContent({ model, contents: prompt });
      return res.text ?? "";
    } catch (err: any) {
      const parsed = parseGeminiError(err);

      // If quota on this model, try next model
      if (parsed === "QUOTA_EXCEEDED" && model !== models[models.length - 1]) {
        continue;
      }

      // Re-throw with clean error code
      throw new Error(parsed);
    }
  }

  throw new Error("QUOTA_EXCEEDED");
}

export async function askGeminiForSQL(question: string, schemaJson: string, geminiKey?: string | null): Promise<string> {
  const prompt = `You are a PostgreSQL expert. Return ONLY a valid SELECT SQL query. No markdown, no explanation.

Schema: ${schemaJson}

Rules:
- Only SELECT queries
- Always GROUP BY when aggregating
- ORDER BY ascending unless asked
- Use DATE_TRUNC for time grouping
- Understand Urdu and English questions

Question: ${question}`;

  const raw = await callGemini(prompt, geminiKey);
  return raw.replace(/```sql/gi, "").replace(/```/g, "").trim();
}

export async function askGeminiForExplanation(question: string, result: any[], geminiKey?: string | null): Promise<string> {
  const prompt = `You are a bilingual analyst (Urdu + English).
User asked: "${question}"
Result: ${JSON.stringify(result.slice(0, 10))}
Reply in the same language as the question. 2-3 sentences max. No technical terms.`;

  return await callGemini(prompt, geminiKey);
}