// app/api/change-password/route.ts
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const userId = (session.user as any).id;
  const { currentPassword, newPassword } = await req.json();

  if (!currentPassword || !newPassword) {
    return Response.json({ error: "Both fields required" }, { status: 400 });
  }
  if (newPassword.length < 6) {
    return Response.json({ error: "New password must be at least 6 characters" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return Response.json({ error: "User not found" }, { status: 404 });

  const valid = await bcrypt.compare(currentPassword, user.password);
  if (!valid) return Response.json({ error: "Current password is incorrect" }, { status: 400 });

  const hashed = await bcrypt.hash(newPassword, 12);
  await prisma.user.update({ where: { id: userId }, data: { password: hashed } });

  return Response.json({ success: true });
}