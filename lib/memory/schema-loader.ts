// lib/memory/schema-loader.ts
// Loads or builds the schema memory for a connected app

import { prisma } from "@/lib/prisma";
import { PrismaClient } from "@prisma/client";

// Build schema from a remote database URL
export async function buildSchemaFromUrl(dbUrl: string): Promise<object> {
  // Create a temp Prisma client pointing to the user's DB
  const tempPrisma = new PrismaClient({ datasources: { db: { url: dbUrl } } });

  try {
    const rows = await tempPrisma.$queryRaw<any[]>`
      SELECT 
        table_name,
        column_name,
        data_type,
        is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public'
      ORDER BY table_name, ordinal_position
    `;

    // Group by table
    const schema: Record<string, any[]> = {};
    for (const row of rows) {
      if (!schema[row.table_name]) schema[row.table_name] = [];
      schema[row.table_name].push({
        column: row.column_name,
        type: row.data_type,
        nullable: row.is_nullable === "YES",
      });
    }

    return schema;
  } finally {
    await tempPrisma.$disconnect();
  }
}

// Get schema for an app (from cache or rebuild)
export async function getAppSchema(appId: string): Promise<object> {
  const app = await prisma.connectedApp.findUnique({
    where: { id: appId },
  });

  if (!app) throw new Error("App not found");

  // Use cached schema if less than 24 hours old
  const cacheValid =
    app.schemaJson &&
    app.schemaBuiltAt &&
    Date.now() - app.schemaBuiltAt.getTime() < 24 * 60 * 60 * 1000;

  if (cacheValid) {
    return JSON.parse(app.schemaJson!);
  }

  // Rebuild from live DB
  if (!app.dbUrl) {
    return {};
  }

  const schema = await buildSchemaFromUrl(app.dbUrl);

  // Save to cache
  await prisma.connectedApp.update({
    where: { id: appId },
    data: {
      schemaJson: JSON.stringify(schema),
      schemaBuiltAt: new Date(),
    },
  });

  return schema;
}