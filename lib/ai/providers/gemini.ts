// lib/ai/providers/gemini.ts
import { AIProvider } from "../types";
import {
  buildExplanationPrompt,
  buildFixSqlPrompt,
  buildSqlPrompt,
} from "../sql-prompts";

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
    return this.callGemini(buildSqlPrompt(question, schema), apiKey, model);
  }

  async generateExplanation(
    question: string,
    result: Array<Record<string, unknown>>,
    apiKey?: string,
    baseUrl?: string,
    model?: string
  ): Promise<string> {
    if (!apiKey) return `Found ${result.length} result(s).`;
    return this.callGemini(buildExplanationPrompt(question, result), apiKey, model);
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
    return this.callGemini(buildFixSqlPrompt(sql, error, schema), apiKey, model);
  }
}
