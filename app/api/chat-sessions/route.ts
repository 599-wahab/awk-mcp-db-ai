// app/api/chat-sessions/route.ts
// Returns past chat logs grouped by date for the chat history sidebar
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const session = await auth();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const userId = (session.user as any).id;
  const { searchParams } = new URL(req.url);
  const appId = searchParams.get("appId");

  // Get user's app IDs
  const apps = await prisma.connectedApp.findMany({
    where: { userId },
    select: { id: true, name: true },
  });
  const appIds = apps.map(a => a.id);
  if (!appIds.length) return Response.json([]);

  const logs = await prisma.chatLog.findMany({
    where: {
      appId: appId ? appId : { in: appIds },
      wasSuccessful: true,
    },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      question: true,
      explanation: true,
      generatedSql: true,
      result: true,
      feedback: true,
      detectedLang: true,
      createdAt: true,
      appId: true,
    },
  });

  return Response.json(logs);
}