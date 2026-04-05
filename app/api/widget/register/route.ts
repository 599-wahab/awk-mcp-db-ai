// app/api/widget/register/route.ts
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { randomBytes } from "crypto";

export async function GET() {
  const session = await auth();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const userId = (session.user as any).id;

  const apps = await prisma.connectedApp.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true, name: true, apiKey: true, origin: true,
      isActive: true, totalChats: true, lastActiveAt: true,
      createdAt: true, schemaBuiltAt: true, dbType: true,
      geminiKey: true,
      // Never expose dbUrl in list
    },
  });

  return Response.json(apps);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const userId = (session.user as any).id;

  const { name, origin, dbUrl, dbType, geminiKey } = await req.json();
  if (!name) return Response.json({ error: "Name required" }, { status: 400 });

  const apiKey = randomBytes(24).toString("hex");

  const app = await prisma.connectedApp.create({
    data: {
      userId, name, apiKey,
      origin: origin || null,
      dbUrl: dbUrl || null,
      dbType: dbType || "POSTGRESQL",
      geminiKey: geminiKey || null,
    },
  });

  const baseUrl = process.env.NEXTAUTH_URL || "https://awk-tld-bot.vercel.app";

  return Response.json({
    id: app.id,
    name: app.name,
    apiKey: app.apiKey,
    snippet: `<script src="${baseUrl}/embed.js" data-api-key="${app.apiKey}"></script>`,
  });
}

export async function DELETE(req: Request) {
  const session = await auth();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const userId = (session.user as any).id;
  const { id } = await req.json();

  const app = await prisma.connectedApp.findUnique({ where: { id } });
  if (!app || app.userId !== userId) return Response.json({ error: "Not found" }, { status: 404 });

  await prisma.connectedApp.delete({ where: { id } });
  return Response.json({ success: true });
}

export async function PATCH(req: Request) {
  const session = await auth();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const userId = (session.user as any).id;
  const { id, dbUrl, dbType, name, origin, geminiKey } = await req.json();

  const app = await prisma.connectedApp.findUnique({ where: { id } });
  if (!app || app.userId !== userId) return Response.json({ error: "Not found" }, { status: 404 });

  await prisma.connectedApp.update({
    where: { id },
    data: {
      ...(name && { name }),
      ...(origin !== undefined && { origin }),
      ...(dbUrl && { dbUrl, schemaJson: null, schemaBuiltAt: null }),
      ...(dbType && { dbType }),
      ...(geminiKey !== undefined && { geminiKey: geminiKey || null }),
    },
  });

  return Response.json({ success: true });
}