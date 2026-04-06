// app/api/settings/route.ts
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const session = await auth();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const userId = (session.user as any).id;
  const { searchParams } = new URL(req.url);
  const appId = searchParams.get("appId");

  if (appId) {
    const app = await prisma.connectedApp.findFirst({
      where: { id: appId, userId },
      select: { 
        id: true, 
        name: true, 
        dbUrl: true, 
        geminiKey: true, 
        dbType: true, 
        origin: true,
        aiProvider: true,
        aiModel: true,
        aiBaseUrl: true,
      },
    });
    if (!app) return Response.json({ error: "Not found" }, { status: 404 });
    return Response.json({
      dbUrl: app.dbUrl || "",
      apiKey: app.geminiKey || "",
      dbType: app.dbType,
      origin: app.origin || "",
      name: app.name,
      aiProvider: app.aiProvider || "GEMINI",
      aiModel: app.aiModel || "",
      aiBaseUrl: app.aiBaseUrl || "",
    });
  }

  const app = await prisma.connectedApp.findFirst({
    where: { userId },
    orderBy: { createdAt: "asc" },
    select: { 
      id: true, 
      name: true, 
      dbUrl: true, 
      geminiKey: true, 
      dbType: true,
      aiProvider: true,
      aiModel: true,
      aiBaseUrl: true,
    },
  });

  return Response.json({
    appId: app?.id || "",
    appName: app?.name || "",
    dbUrl: app?.dbUrl || "",
    apiKey: app?.geminiKey || "",
    aiProvider: app?.aiProvider || "GEMINI",
    aiModel: app?.aiModel || "",
    aiBaseUrl: app?.aiBaseUrl || "",
  });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const userId = (session.user as any).id;
  const { appId, dbUrl, apiKey, name, origin, dbType, aiProvider, aiModel, aiBaseUrl } = await req.json();

  if (!appId) return Response.json({ error: "appId required" }, { status: 400 });

  const app = await prisma.connectedApp.findFirst({ where: { id: appId, userId } });
  if (!app) return Response.json({ error: "Not found" }, { status: 404 });

  await prisma.connectedApp.update({
    where: { id: appId },
    data: {
      ...(dbUrl !== undefined && { dbUrl: dbUrl || null, schemaJson: null, schemaBuiltAt: null }),
      ...(apiKey !== undefined && { geminiKey: apiKey || null }),
      ...(name && { name }),
      ...(origin !== undefined && { origin: origin || null }),
      ...(dbType && { dbType }),
      ...(aiProvider && { aiProvider }),
      ...(aiModel !== undefined && { aiModel: aiModel || null }),
      ...(aiBaseUrl !== undefined && { aiBaseUrl: aiBaseUrl || null }),
    },
  });

  return Response.json({ success: true });
}