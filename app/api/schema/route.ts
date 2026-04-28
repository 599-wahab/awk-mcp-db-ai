// app/api/schema/route.ts
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAppSchema } from "@/lib/memory/schema-loader";

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
  } catch (err: any) {
    console.error("Schema build error:", err);
    return Response.json({ error: "Schema build failed: " + err.message }, { status: 500 });
  }
}