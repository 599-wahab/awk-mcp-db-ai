// app/api/health/route.ts
// Returns DB and AI status — AI check uses app's actual configured provider
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function GET() {
  let dbStatus = false;
  let aiStatus = false;

  // DB check
  try {
    await prisma.$queryRaw`SELECT 1`;
    dbStatus = true;
  } catch {}

  // AI check — try the session user's first connected app provider
  // Falls back to checking Gemini with env key
  try {
    const session = await auth();
    let geminiKey: string | null = process.env.GEMINI_API_KEY || null;
    let model = "gemini-1.5-flash";

    if (session) {
      const userId = (session.user as any).id;
      const app = await prisma.connectedApp.findFirst({
        where: { userId, isActive: true },
        select: { geminiKey: true, aiModel: true, aiProvider: true, aiBaseUrl: true },
      });
      if (app?.geminiKey) geminiKey = app.geminiKey;
      if (app?.aiModel)   model     = app.aiModel;

      // For local providers — just mark as active if URL is set
      if (app?.aiProvider === "LMSTUDIO" || app?.aiProvider === "OLLAMA") {
        const url = app.aiBaseUrl || "http://localhost:1234/v1";
        try {
          const r = await fetch(url, { signal: AbortSignal.timeout(2000) });
          aiStatus = r.ok || r.status < 500;
        } catch {}
        return Response.json({ database: dbStatus, ai: aiStatus });
      }
    }

    if (geminiKey) {
      const url = `https://generativelanguage.googleapis.com/v1/models/${model}:generateContent?key=${geminiKey}`;
      const r = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: "ping" }] }] }),
        signal: AbortSignal.timeout(5000),
      });
      aiStatus = r.ok;
    }
  } catch {}

  return Response.json({ database: dbStatus, ai: aiStatus });
}