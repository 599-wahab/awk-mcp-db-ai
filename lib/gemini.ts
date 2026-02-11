//lib/gemini.ts
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY!,
});

// small helper
const sleep = (ms: number) => new Promise(res => setTimeout(res, ms));

export async function askGemini(prompt: string): Promise<string> {
  const models = [
    "gemini-3-flash-preview", // fastest, but overloaded often
    "gemini-1.5-flash",       // fallback
    "gemini-1.5-pro",         // last resort (slower)
  ];

  let lastError: any;

  for (const model of models) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents: prompt,
        });

        if (response.text) {
          console.log(`Gemini success with ${model}`);
          return response.text.trim();
        }
      } catch (err: any) {
        lastError = err;
        console.warn(
          `Gemini error with ${model} (attempt ${attempt}):`,
          err?.message || err
        );

        // wait before retry
        await sleep(800);
      }
    }
  }

  throw new Error(
    lastError?.message ||
      "All Gemini models are currently overloaded. Try again later."
  );
}
