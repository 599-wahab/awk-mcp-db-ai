// app/api/health/route.ts

import { prisma } from "@/lib/prisma";
import { GoogleGenAI } from "@google/genai";

export async function GET() {
  let dbStatus = false;
  let aiStatus = false;

  // DB check
  try {
    await prisma.$queryRaw`SELECT 1`;
    dbStatus = true;
  } catch {}

  // AI check
  try {
    const ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY!,
    });

    await ai.models.generateContent({
      model: "gemini-3-flash",
      contents: "ping",
    });

    aiStatus = true;
  } catch {}

  return Response.json({
    database: dbStatus,
    ai: aiStatus,
  });
}
