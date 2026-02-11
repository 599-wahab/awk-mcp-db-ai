//ap/api/schema/route.ts
import { prisma } from "@/lib/prisma";

export async function GET() {
  const schema = await prisma.$queryRaw`
    SELECT table_name, column_name, data_type
    FROM information_schema.columns
    WHERE table_schema = 'public'
    ORDER BY table_name;
  `;

  return Response.json(schema);
}