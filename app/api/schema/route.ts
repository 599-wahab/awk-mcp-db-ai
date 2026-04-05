// app/api/schema/route.ts
// Manually trigger schema rebuild for a connected app
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildSchemaFromUrl } from "@/lib/memory/schema-loader";

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const userId = (session.user as any).id;
  const { appId } = await req.json();

  const app = await prisma.connectedApp.findUnique({ where: { id: appId } });
  if (!app || app.userId !== userId) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  if (!app.dbUrl) {
    return Response.json({ error: "No database URL configured" }, { status: 400 });
  }

  try {
    const schema = await buildSchemaFromUrl(app.dbUrl);
    await prisma.connectedApp.update({
      where: { id: appId },
      data: { schemaJson: JSON.stringify(schema), schemaBuiltAt: new Date() },
    });
    return Response.json({ success: true, tables: Object.keys(schema).length });
  } catch (err: any) {
    return Response.json({ error: "Schema build failed", details: err.message }, { status: 500 });
  }
}