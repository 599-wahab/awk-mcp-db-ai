// app/api/settings/route.ts
// Saves Gemini API key and DB URL for a connected app
// This is what the Settings page reads/writes

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const session = await auth();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const userId = (session.user as any).id;
  const { searchParams } = new URL(req.url);
  const appId = searchParams.get("appId");

  if (appId) {
    // Get settings for a specific app
    const app = await prisma.connectedApp.findFirst({
      where: { id: appId, userId },
      select: { id: true, name: true, dbUrl: true, geminiKey: true, dbType: true, origin: true },
    });
    if (!app) return Response.json({ error: "Not found" }, { status: 404 });
    return Response.json({
      dbUrl: app.dbUrl || "",
      geminiKey: app.geminiKey || "",
      dbType: app.dbType,
      origin: app.origin || "",
      name: app.name,
    });
  }

  // Return first app's settings (for simple settings page)
  const app = await prisma.connectedApp.findFirst({
    where: { userId },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, dbUrl: true, geminiKey: true, dbType: true },
  });

  return Response.json({
    appId: app?.id || "",
    appName: app?.name || "",
    dbUrl: app?.dbUrl || "",
    geminiKey: app?.geminiKey || "",
  });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const userId = (session.user as any).id;
  const { appId, dbUrl, geminiKey, name, origin, dbType } = await req.json();

  if (!appId) return Response.json({ error: "appId required" }, { status: 400 });

  const app = await prisma.connectedApp.findFirst({ where: { id: appId, userId } });
  if (!app) return Response.json({ error: "Not found" }, { status: 404 });

  await prisma.connectedApp.update({
    where: { id: appId },
    data: {
      ...(dbUrl !== undefined && { dbUrl: dbUrl || null, schemaJson: null, schemaBuiltAt: null }),
      ...(geminiKey !== undefined && { geminiKey: geminiKey || null }),
      ...(name && { name }),
      ...(origin !== undefined && { origin: origin || null }),
      ...(dbType && { dbType }),
    },
  });

  return Response.json({ success: true });
}