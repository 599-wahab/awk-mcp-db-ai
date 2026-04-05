// lib/gemini.ts
// IMPORTANT: No top-level initialization — fixes Vercel build error
// "API key must be set" happens when GoogleGenAI is created at module load time
import { GoogleGenAI } from "@google/genai";

// Lazy getter — only runs when a function is actually called (not at build time)
function getAI(): GoogleGenAI {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY is not set in environment variables.");
  return new GoogleGenAI({ apiKey: key });
}

export async function askGemini(prompt: string): Promise<string> {
  const response = await getAI().models.generateContent({
    model: "gemini-2.0-flash",
    contents: prompt,
  });
  return response.text ?? "";
}

export async function askGeminiForSQL(
  question: string,
  schemaJson: string
): Promise<string> {
  const prompt = `You are a PostgreSQL expert AI assistant.

Return ONLY a valid SELECT SQL query. No markdown, no explanation, no comments.

Database schema:
${schemaJson}

Rules:
- Only SELECT queries
- Always GROUP BY when aggregating
- ORDER BY ascending unless asked otherwise
- Use DATE_TRUNC for time-based grouping
- For stacked charts return: month, category, total_amount
- Understand both Urdu and English questions

User question: ${question}`;

  const raw = await askGemini(prompt);
  return raw.replace(/```sql/gi, "").replace(/```/g, "").trim();
}

export async function askGeminiForExplanation(
  question: string,
  result: any[]
): Promise<string> {
  const prompt = `You are a bilingual data analyst who speaks Urdu and English fluently.

User asked: "${question}"
Database result: ${JSON.stringify(result.slice(0, 15))}

Instructions:
- Detect if the question is in Urdu (including Roman Urdu) or English
- Reply in the EXACT SAME language
- Give a short, clear, friendly summary of what the data shows
- Maximum 2-3 sentences
- No technical terms, no SQL mentions`;

  return await askGemini(prompt);
}