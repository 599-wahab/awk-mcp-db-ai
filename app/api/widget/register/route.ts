// app/api/widget/register/route.ts
import { randomBytes } from "crypto";
import { DbType } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type SessionWithUserId = {
  user?: {
    id?: string;
  };
};

type RegisterBody = {
  name?: string;
  origin?: string;
  dbUrl?: string;
  dbType?: DbType;
  geminiKey?: string;
  contextJson?: unknown;
};

type MutateBody = RegisterBody & {
  id?: string;
};

function getSessionUserId(session: unknown) {
  return (session as SessionWithUserId)?.user?.id || "";
}

async function readJson<T>(req: Request): Promise<T | null> {
  try {
    return (await req.json()) as T;
  } catch {
    return null;
  }
}

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeOrigin(value: unknown) {
  const origin = normalizeText(value);
  if (!origin) return null;

  try {
    return new URL(origin).origin;
  } catch {
    return null;
  }
}

function normalizeDbType(value: unknown): DbType {
  return Object.values(DbType).includes(value as DbType)
    ? (value as DbType)
    : DbType.POSTGRESQL;
}

function serializeContext(value: unknown) {
  if (!value || typeof value !== "object") return null;
  return JSON.stringify(value);
}

export async function GET() {
  const session = await auth();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const userId = getSessionUserId(session);
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const apps = await prisma.connectedApp.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      apiKey: true,
      origin: true,
      isActive: true,
      totalChats: true,
      lastActiveAt: true,
      createdAt: true,
      schemaBuiltAt: true,
      dbType: true,
      geminiKey: true,
      contextJson: true,
    },
  });

  return Response.json(
    apps.map((app) => ({
      ...app,
      geminiKey: app.geminiKey ? "configured" : "",
    })),
  );
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const userId = getSessionUserId(session);
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await readJson<RegisterBody>(req);
  if (!body) return Response.json({ error: "Invalid JSON body" }, { status: 400 });

  const name = normalizeText(body.name);
  const dbUrl = normalizeText(body.dbUrl);
  const origin = normalizeOrigin(body.origin);

  if (!name) return Response.json({ error: "Name required" }, { status: 400 });
  if (!dbUrl) return Response.json({ error: "Database URL required" }, { status: 400 });
  if (body.origin && !origin) {
    return Response.json({ error: "Origin must be a valid URL" }, { status: 400 });
  }

  const apiKey = randomBytes(32).toString("hex");

  const app = await prisma.connectedApp.create({
    data: {
      userId,
      name,
      apiKey,
      origin,
      dbUrl,
      dbType: normalizeDbType(body.dbType),
      geminiKey: normalizeText(body.geminiKey) || null,
      contextJson: serializeContext(body.contextJson),
    },
  });

  const baseUrl = process.env.NEXTAUTH_URL || "https://awk-tld-bot.vercel.app";

  return Response.json({
    id: app.id,
    name: app.name,
    apiKey: app.apiKey,
    snippet: `<script src="${baseUrl}/embed.js" data-api-key="${app.apiKey}" data-widget-mode="erp" data-tenant-id="ERP_TENANT_ID" data-user-id="ERP_USER_ID" data-user-email="USER_EMAIL"></script>`,
  });
}

export async function DELETE(req: Request) {
  const session = await auth();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const userId = getSessionUserId(session);
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await readJson<MutateBody>(req);
  const id = normalizeText(body?.id);
  if (!id) return Response.json({ error: "App id required" }, { status: 400 });

  const app = await prisma.connectedApp.findUnique({ where: { id } });
  if (!app || app.userId !== userId) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.connectedApp.delete({ where: { id } });
  return Response.json({ success: true });
}

export async function PATCH(req: Request) {
  const session = await auth();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const userId = getSessionUserId(session);
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await readJson<MutateBody>(req);
  const id = normalizeText(body?.id);
  if (!id) return Response.json({ error: "App id required" }, { status: 400 });

  const app = await prisma.connectedApp.findUnique({ where: { id } });
  if (!app || app.userId !== userId) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const origin =
    body && "origin" in body ? normalizeOrigin(body.origin) : undefined;
  if (body?.origin && !origin) {
    return Response.json({ error: "Origin must be a valid URL" }, { status: 400 });
  }

  const dbUrl = normalizeText(body?.dbUrl);

  await prisma.connectedApp.update({
    where: { id },
    data: {
      ...(normalizeText(body?.name) && { name: normalizeText(body?.name) }),
      ...(origin !== undefined && { origin }),
      ...(dbUrl && { dbUrl, schemaJson: null, schemaBuiltAt: null }),
      ...(body?.dbType && { dbType: normalizeDbType(body.dbType) }),
      ...(body && "geminiKey" in body && {
        geminiKey: normalizeText(body.geminiKey) || null,
      }),
      ...(body && "contextJson" in body && {
        contextJson: serializeContext(body.contextJson),
      }),
    },
  });

  return Response.json({ success: true });
}
