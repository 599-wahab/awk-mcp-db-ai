// app/api/chat-history/route.ts
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const session = await auth();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const userId = (session.user as any).id;
  const { searchParams } = new URL(req.url);
  const appId = searchParams.get("appId");
  const format = searchParams.get("format") || "json";
  const onlyGood = searchParams.get("onlyGood") === "true";
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "50");

  // Verify app belongs to this user
  const appWhere = appId
    ? { id: appId, userId }
    : { userId };

  const apps = await prisma.connectedApp.findMany({
    where: appWhere,
    select: { id: true },
  });

  const appIds = apps.map((a) => a.id);
  if (!appIds.length) return Response.json([]);

  const logs = await prisma.chatLog.findMany({
    where: {
      appId: { in: appIds },
      wasSuccessful: onlyGood ? true : undefined,
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    skip: (page - 1) * limit,
    select: {
      id: true,
      appId: true,
      question: true,
      generatedSql: true,
      result: true,
      explanation: true,
      wasSuccessful: true,
      detectedLang: true,
      createdAt: true,
    },
  });

  if (format === "jsonl") {
    const lines = logs
      .map((log) =>
        JSON.stringify({
          prompt: log.question,
          completion: log.explanation,
          sql: log.generatedSql,
          lang: log.detectedLang,
          success: log.wasSuccessful,
        })
      )
      .join("\n");

    return new Response(lines, {
      headers: {
        "Content-Type": "application/jsonl",
        "Content-Disposition": `attachment; filename="chat-history.jsonl"`,
      },
    });
  }

  return Response.json(logs);
}