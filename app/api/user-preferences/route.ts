// app/api/user-preferences/route.ts
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const userId = (session.user as any).id;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { preferredLang: true, textSize: true, name: true, email: true },
  });

  return Response.json(user);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const userId = (session.user as any).id;

  const { preferredLang, textSize } = await req.json();

  await prisma.user.update({
    where: { id: userId },
    data: {
      ...(preferredLang && { preferredLang }),
      ...(textSize && { textSize }),
    },
  });

  return Response.json({ success: true });
}