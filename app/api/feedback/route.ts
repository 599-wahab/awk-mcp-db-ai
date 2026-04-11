// app/api/feedback/route.ts
import { prisma } from "@/lib/prisma";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, x-api-key",
};

export async function OPTIONS() {
  return new Response(null, { status: 200, headers: CORS });
}

export async function POST(req: Request) {
  const { chatLogId, feedback } = await req.json();

  if (!chatLogId || !["like", "dislike", null].includes(feedback)) {
    return Response.json({ error: "Invalid request" }, { status: 400, headers: CORS });
  }

  await prisma.chatLog.update({
    where: { id: chatLogId },
    data: { feedback },
  });

  return Response.json({ success: true }, { headers: CORS });
}