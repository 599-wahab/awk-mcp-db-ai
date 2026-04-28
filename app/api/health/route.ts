// app/api/health/route.ts
import { prisma } from "@/lib/prisma";

export async function GET() {
  let dbStatus = false;
  let aiStatus = false;

  try {
    await prisma.$queryRaw`SELECT 1`;
    dbStatus = true;
  } catch {}

  // Lazy import — do NOT initialize GoogleGenAI at module level
  try {
    const { GoogleGenAI } = await import("@google/genai");
    const key = process.env.GEMINI_API_KEY;
    if (key) {
      const ai = new GoogleGenAI({ apiKey: key });
      await ai.models.generateContent({
        model: "gemini-2.0-flash",
        contents: "ping",
      });
      aiStatus = true;
    }
  } catch {}

  return Response.json({ database: dbStatus, ai: aiStatus });
}