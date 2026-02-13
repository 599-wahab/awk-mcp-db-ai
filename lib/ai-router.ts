import { askGemini } from "./gemini";
import { askOpenAI } from "./openai";
import { askDeepSeek } from "./deepseek";

type Provider = {
  name: string;
  fn: (prompt: string) => Promise<string>;
};

export async function askAI(
  prompt: string,
  force?: string
): Promise<string> {
  const providers: Provider[] = [
    { name: "Gemini", fn: askGemini },
    { name: "OpenAI", fn: askOpenAI },
    { name: "DeepSeek", fn: askDeepSeek },
  ];

  /* ---------------- FORCE SPECIFIC PROVIDER ---------------- */

  if (force) {
    const provider = providers.find((p) => p.name === force);
    if (!provider) throw new Error("Invalid provider name");

    console.log(`⚡ Forced provider: ${force}`);
    return await provider.fn(prompt);
  }

  /* ---------------- PARALLEL EXECUTION ---------------- */

  console.log("🚀 Running all AI providers in parallel...");

  const results = await Promise.allSettled(
    providers.map((p) => p.fn(prompt))
  );

  for (let i = 0; i < results.length; i++) {
    const result = results[i];

    if (result.status === "fulfilled" && result.value?.length > 0) {
      console.log(`✅ Success with ${providers[i].name}`);
      return result.value;
    }
  }

  throw new Error("❌ All AI providers failed.");
}
