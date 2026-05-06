// lib/ai/providers/gemini.ts
import { AIProvider } from "../types";

type GeminiResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
};

export class GeminiProvider implements AIProvider {
  private defaultModel = "gemini-2.5-flash";
  private stableFallbackModels = [
    "gemini-2.5-flash",
  ];

  private sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private getFallbackModels(model?: string): string[] {
    const selectedModel = model || this.defaultModel;

    return [
      selectedModel,
      ...this.stableFallbackModels,
    ].filter((value, index, arr) => value && arr.indexOf(value) === index);
  }

  private isPreviewOrProModel(model: string): boolean {
    return /preview|pro/i.test(model);
  }

  private async callGemini(
    prompt: string,
    apiKey: string,
    model?: string
  ): Promise<string> {
    const modelsToTry = this.getFallbackModels(model);
    let lastError = "";

    for (const modelName of modelsToTry) {
      for (let attempt = 1; attempt <= 2; attempt++) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000);

        try {
          const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

          const response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            signal: controller.signal,
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: {
                temperature: 0.1,
                maxOutputTokens: 2000,
              },
            }),
          });

          clearTimeout(timeout);

          if (!response.ok) {
            const error = await response.text();
            lastError = error;

            console.error("Gemini API Error:", {
              status: response.status,
              model: modelName,
              attempt,
              error,
            });

            if (response.status === 404) {
              break; // try next model
            }

            if (response.status === 429) {
              if (this.isPreviewOrProModel(modelName)) {
                break; // try a cheaper/stable flash fallback
              }
              throw new Error("QUOTA_EXCEEDED");
            }

            if (response.status === 403) {
              throw new Error("INVALID_KEY");
            }

            if (response.status === 503) {
              if (attempt < 2) {
                await this.sleep(1000 * attempt);
                continue;
              }
              break; // try next fallback model
            }

            throw new Error(`AI_ERROR:${error}`);
          }

          const data = (await response.json()) as GeminiResponse;
          const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

          if (!text.trim()) {
            throw new Error("AI_ERROR: Empty response from Gemini");
          }

          return text;
        } catch (err: unknown) {
          clearTimeout(timeout);

          if (err instanceof Error && err.name === "AbortError") {
            lastError = "Gemini request timeout";
            console.error("Gemini timeout:", { model: modelName, attempt });
            if (attempt < 2) {
              await this.sleep(1000 * attempt);
              continue;
            }
            break;
          }

          if (
            err instanceof Error &&
            err.message === "INVALID_KEY"
          ) {
            throw err;
          }

          if (err instanceof Error && err.message === "QUOTA_EXCEEDED") {
            throw err;
          }

          lastError = err instanceof Error ? err.message : String(err);
          console.error("Gemini call failed:", {
            model: modelName,
            attempt,
            error: lastError,
          });

          if (attempt < 2) {
            await this.sleep(1000 * attempt);
            continue;
          }

          break;
        }
      }
    }

    if (lastError.includes("quota") || lastError.includes("429")) {
      throw new Error("QUOTA_EXCEEDED");
    }

    if (lastError.includes("API key") || lastError.includes("403")) {
      throw new Error("INVALID_KEY");
    }

    if (lastError.includes("404") || lastError.includes("not found")) {
      throw new Error("MODEL_NOT_FOUND");
    }

    if (
      lastError.includes("503") ||
      lastError.includes("UNAVAILABLE") ||
      lastError.includes("high demand") ||
      lastError.includes("timeout")
    ) {
      throw new Error("AI_OVERLOADED");
    }

    throw new Error(`AI_ERROR:${lastError || "Gemini request failed"}`);
  }

  async generateSQL(
    question: string,
    schema: string,
    apiKey?: string,
    baseUrl?: string,
    model?: string
  ): Promise<string> {
    if (!apiKey) throw new Error("NO_KEY");

    const prompt = `You are a PostgreSQL expert. Convert the user question into a valid PostgreSQL SELECT query.

DATABASE SCHEMA:
${schema}

USER QUESTION: ${question}

STRICT RULES — follow all of them:
1. Return ONLY a raw SQL query. No markdown, no backticks, no explanation, no comments.
2. ONLY write SELECT statements. Never write INSERT, UPDATE, DELETE, DROP, CREATE, ALTER, TRUNCATE.
3. If the question is about tasks, look for a table named "tasks" or similar. Use columns that exist in the schema.
4. If a column or table does not exist in the schema, do NOT invent it. Use only what is in the schema above.
5. Always add LIMIT 100 unless the question asks for a count/sum/aggregate.
6. For boolean columns like "completed", "is_done", "status" — use proper boolean or text comparison based on the schema column type.
7. For "pending" or "remaining" tasks — filter where completed = false OR status NOT IN ('done','completed','finished') depending on schema.
8. Never use syntax like "tasks left" as a column — translate intent into real column filters.
9. Use simple, clean SQL. Avoid CTEs or subqueries unless absolutely necessary.
10. If the schema includes _tables, _nameSearchColumns, _moneyAndRevenueColumns, or _tenantOwnedTables, use those helper fields to choose real tables and columns.
11. For questions like "who is wahad", "who is awk", or "details about X", search likely person/customer/company tables using real name/email/phone/code/title columns with ILIKE.
12. For income, revenue, sales, payment, or total questions, use real amount/total/payment/revenue columns from the schema. If multiple valid payment/revenue tables exist, combine them with UNION ALL and SUM.
13. If tenant_id filtering is shown in the prompt/schema hint, include it on every tenant-owned table.
14. If you cannot write a valid SELECT query for this question, return exactly: SELECT 'UNABLE_TO_QUERY' AS error

SQL query:`;

    return this.callGemini(prompt, apiKey, model);
  }

  async generateExplanation(
    question: string,
    result: Array<Record<string, unknown>>,
    apiKey?: string,
    baseUrl?: string,
    model?: string
  ): Promise<string> {
    if (!apiKey) return `Found ${result.length} result(s).`;

    const isUrdu =
      /[\u0600-\u06FF]/.test(question) ||
      /\b(kya|hai|hain|aap|mujhe|batao|dikhao|kitne|kitni|total|salary|order|sale|باقی|کام|مصنوع)\b/i.test(
        question
      );

    const langInstruction = isUrdu
      ? "Respond in Urdu language only. Use simple Urdu words."
      : "Respond in English only.";

    const prompt = `${langInstruction}

Explain these database query results to the user in 1-3 simple sentences. Be direct and helpful.

User asked: ${question}
Query results (sample): ${JSON.stringify(result.slice(0, 10))}
Total rows returned: ${result.length}

${isUrdu ? "جواب اردو میں دیں:" : "Answer:"}`;

    return this.callGemini(prompt, apiKey, model);
  }

  async fixSQL(
    sql: string,
    error: string,
    schema: string,
    apiKey?: string,
    baseUrl?: string,
    model?: string
  ): Promise<string> {
    if (!apiKey) throw new Error("NO_KEY");

    const prompt = `You are a PostgreSQL expert. Fix this broken SQL query.

SCHEMA:
${schema}

BROKEN SQL:
${sql}

ERROR MESSAGE:
${error}

RULES:
1. Return ONLY the corrected SQL query. No explanation, no markdown, no backticks.
2. Must be a SELECT statement only.
3. Only use tables and columns that exist in the schema above.
4. Preserve required tenant_id filters from the schema hint.
5. For name searches, use real name/email/phone/code/title columns with ILIKE.
6. For income/revenue questions, use real amount/total/payment columns from the schema.
7. If the original query concept is impossible with this schema, return: SELECT 'UNABLE_TO_QUERY' AS error

FIXED SQL:`;

    return this.callGemini(prompt, apiKey, model);
  }
}
