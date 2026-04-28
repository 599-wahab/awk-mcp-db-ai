import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });
  // Return empty preferences for now
  return Response.json({});
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });
  // Accept and ignore
  return Response.json({ success: true });
}