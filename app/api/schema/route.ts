// app/api/schema/route.ts
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAppSchema } from "@/lib/memory/schema-loader";

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function getErrorCode(error: unknown) {
  if (error && typeof error === "object" && "code" in error) {
    return String((error as { code?: unknown }).code || "");
  }
  return "";
}

function getDatabaseHost(dbUrl: string) {
  try {
    return new URL(dbUrl).hostname;
  } catch {
    return "";
  }
}

function formatSchemaBuildError(error: unknown, dbUrl: string) {
  const message = getErrorMessage(error);
  const code = getErrorCode(error);
  const host = getDatabaseHost(dbUrl);

  if (code === "ENOTFOUND" || /getaddrinfo ENOTFOUND/i.test(message)) {
    return {
      error: host
        ? `Database host "${host}" could not be found.`
        : "Database host could not be found.",
      code: "DB_HOST_NOT_FOUND",
      advice:
        "Check that the database URL was copied correctly, the Supabase project is active, and the host exists. For Supabase, copy the current connection string from the Supabase database settings; if the direct host does not resolve from your deployment, try the pooler connection string.",
      rawError: message,
    };
  }

  if (code === "ECONNREFUSED") {
    return {
      error: host
        ? `Connection refused by database host "${host}".`
        : "Connection refused by database host.",
      code: "DB_CONNECTION_REFUSED",
      advice:
        "Check that the database is running and accepts external connections from this app.",
      rawError: message,
    };
  }

  if (code === "ETIMEDOUT" || /timeout/i.test(message)) {
    return {
      error: "Database connection timed out.",
      code: "DB_CONNECTION_TIMEOUT",
      advice:
        "Check firewall/network settings, SSL mode, and whether your database allows connections from the hosted bot.",
      rawError: message,
    };
  }

  if (/password authentication failed/i.test(message)) {
    return {
      error: "Database username or password was rejected.",
      code: "DB_AUTH_FAILED",
      advice:
        "Update the saved database URL with the correct username and password, then rebuild the schema again.",
      rawError: message,
    };
  }

  if (/ssl/i.test(message)) {
    return {
      error: "Database SSL connection failed.",
      code: "DB_SSL_ERROR",
      advice:
        "For hosted Postgres databases, add or verify sslmode=require in the connection string.",
      rawError: message,
    };
  }

  return {
    error: "Schema build failed: " + message,
    code: "SCHEMA_BUILD_FAILED",
    advice:
      "Check the saved database URL, database availability, credentials, and network access.",
    rawError: message,
  };
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const userId = (session.user as any).id;
  const { appId } = await req.json();

  const app = await prisma.connectedApp.findUnique({ where: { id: appId } });
  if (!app || app.userId !== userId) return Response.json({ error: "Not found" }, { status: 404 });
  if (!app.dbUrl) return Response.json({ error: "No database URL configured. Go to Settings first." }, { status: 400 });

  try {
    const schema = await getAppSchema(appId);
    if (!schema || !Array.isArray(schema.tables)) {
      throw new Error("Schema is missing tables array");
    }
    return Response.json({ success: true, tables: schema.tables.length });
  } catch (err: unknown) {
    console.error("Schema build error:", err);
    return Response.json(formatSchemaBuildError(err, app.dbUrl), { status: 500 });
  }
}
