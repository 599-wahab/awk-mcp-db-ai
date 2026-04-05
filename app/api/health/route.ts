// app/api/health/route.ts
import { prisma } from "@/lib/prisma";

export async function GET() {
  let dbStatus = false;
  let aiStatus = false;

  try {
    await prisma.$queryRaw`SELECT 1`;
    dbStatus = true;
  } catch {}

  try {
    const { GoogleGenAI } = await import("@google/genai");
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
    await ai.models.generateContent({ model: "gemini-2.0-flash", contents: "ping" });
    aiStatus = true;
  } catch {}

  return Response.json({ database: dbStatus, ai: aiStatus });
}