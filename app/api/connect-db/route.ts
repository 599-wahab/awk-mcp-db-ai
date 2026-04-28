// app/api/connect-db/route.ts
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";

function generateApiKey(): string {
  return crypto.randomBytes(32).toString('hex');
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.email) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user) {
    return Response.json({ error: "User not found" }, { status: 404 });
  }

  const { databaseUrl, geminiKey, aiProvider, aiModel, aiBaseUrl } = await req.json();
  if (!databaseUrl) {
    return Response.json({ error: "databaseUrl is required" }, { status: 400 });
  }

  // Check if user already has an active connection
  const existing = await prisma.connectedApp.findFirst({ where: { userId: user.id, isActive: true } });
  if (existing) {
    return Response.json({ error: "You already have an active database connection. Deactivate it first." }, { status: 409 });
  }

  const apiKey = generateApiKey();
  const app = await prisma.connectedApp.create({
    data: {
      apiKey,
      name: `${user.name || user.email}'s ERP`,
      isActive: true,
      dbUrl: databaseUrl,
      geminiKey: geminiKey || null,
      aiProvider: aiProvider || 'GEMINI',
      aiModel: aiModel || null,
      aiBaseUrl: aiBaseUrl || null,
      totalChats: 0,
      lastActiveAt: new Date(),
      userId: user.id,
    },
  });

  // Trigger async schema fetch
  import("@/lib/memory/schema-loader").then(({ getAppSchema }) => {
    getAppSchema(app.id).catch(console.error);
  });

  return Response.json({
    apiKey: app.apiKey,
    appId: app.id,
    message: "Database connected. Use this API key in your ERP widget.",
  });
}