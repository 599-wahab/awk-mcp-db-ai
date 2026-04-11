// app/api/chat-history/route.ts
// Returns chat logs for AI training data export
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const session = await auth();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const userId = (session.user as any).id;
  const { searchParams } = new URL(req.url);
  const appId    = searchParams.get("appId");
  const format   = searchParams.get("format") || "json";    // "json" | "jsonl"
  const onlyGood = searchParams.get("onlyGood") === "true"; // only liked/successful

  const apps = await prisma.connectedApp.findMany({
    where: { userId },
    select: { id: true },
  });
  const appIds = apps.map(a => a.id);
  if (!appIds.length) return Response.json([]);

  const logs = await prisma.chatLog.findMany({
    where: {
      appId: appId ? appId : { in: appIds },
      wasSuccessful: true,
      ...(onlyGood && { feedback: "like" }),
    },
    orderBy: { createdAt: "desc" },
    take: 2000,
    select: {
      id: true,
      question: true,
      generatedSql: true,
      explanation: true,
      feedback: true,
      detectedLang: true,
      createdAt: true,
      appId: true,
    },
  });

  // JSONL format — one JSON object per line (ideal for fine-tuning)
  if (format === "jsonl") {
    const lines = logs
      .filter(l => l.generatedSql)
      .map(l => JSON.stringify({
        prompt: l.question,
        completion: l.generatedSql,
        explanation: l.explanation,
        lang: l.detectedLang,
        feedback: l.feedback,
      }))
      .join("\n");

    return new Response(lines, {
      headers: {
        "Content-Type": "application/jsonl",
        "Content-Disposition": `attachment; filename="training-data-${Date.now()}.jsonl"`,
      },
    });
  }

  return Response.json(logs);
}