// lib/memory/schema-loader.ts
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';

const prisma = new PrismaClient();

type ColumnInfo = {
  table_name: string;
  column_name: string;
  data_type: string;
  is_nullable: string;
};

type ForeignKeyInfo = {
  local_table: string;
  local_column: string;
  referenced_table: string;
  referenced_column: string;
};

export type DatabaseSchema = {
  tables: ColumnInfo[];
  foreignKeys: ForeignKeyInfo[];
};

/**
 * Returns the schema for a given connected app.
 * Uses cached schema if less than 7 days old and valid, otherwise fetches fresh.
 */
export async function getAppSchema(appId: string): Promise<DatabaseSchema> {
  const app = await prisma.connectedApp.findUnique({
    where: { id: appId },
    select: { schemaJson: true, schemaBuiltAt: true, dbUrl: true },
  });
  if (!app) throw new Error('App not found');

  // Try cached schema if exists and not too old
  if (app.schemaJson && app.schemaBuiltAt) {
    const age = Date.now() - new Date(app.schemaBuiltAt).getTime();
    if (age < 7 * 24 * 60 * 60 * 1000) {
      const cached = JSON.parse(app.schemaJson as string);
      // Validate that cached schema has expected structure
      if (cached && Array.isArray(cached.tables) && Array.isArray(cached.foreignKeys)) {
        return cached as DatabaseSchema;
      }
      // If invalid, fall through to fetch fresh
      console.warn(`Invalid cached schema for app ${appId}, refetching`);
    }
  }

  if (!app.dbUrl) {
    throw new Error('No database URL configured for this app');
  }

  const schema = await fetchDatabaseSchema(app.dbUrl);
  await prisma.connectedApp.update({
    where: { id: appId },
    data: {
      schemaJson: JSON.stringify(schema),
      schemaBuiltAt: new Date(),
    },
  });
  return schema;
}

// fetchDatabaseSchema remains unchanged
async function fetchDatabaseSchema(dbUrl: string): Promise<DatabaseSchema> {
  const pool = new Pool({ connectionString: dbUrl });
  const client = await pool.connect();
  try {
    const columnQuery = `
      SELECT table_name, column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public'
      ORDER BY table_name, ordinal_position;
    `;
    const columnsRes = await client.query(columnQuery);
    const tables: ColumnInfo[] = columnsRes.rows;

    const fkQuery = `
      SELECT
        tc.table_name AS local_table,
        kcu.column_name AS local_column,
        ccu.table_name AS referenced_table,
        ccu.column_name AS referenced_column
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
      JOIN information_schema.constraint_column_usage ccu
        ON ccu.constraint_name = tc.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_schema = 'public';
    `;
    const fkRes = await client.query(fkQuery);
    const foreignKeys: ForeignKeyInfo[] = fkRes.rows;

    return { tables, foreignKeys };
  } finally {
    client.release();
    await pool.end();
  }
}