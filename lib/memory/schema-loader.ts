//lib/memory/schema-loader.ts
import fs from "fs";
import path from "path";
import { prisma } from "@/lib/prisma";

const MEMORY_PATH = path.join(
  process.cwd(),
  "lib/memory/db-schema.json"
);

export async function loadOrCreateSchema() {
  // 1️⃣ If file exists, try to read it safely
  if (fs.existsSync(MEMORY_PATH)) {
    try {
      const content = fs.readFileSync(MEMORY_PATH, "utf-8");

      // handle empty file
      if (!content.trim()) {
        throw new Error("Schema file is empty");
      }

      return JSON.parse(content);
    } catch (err) {
      console.warn(
        "⚠️ MCP memory corrupted. Rebuilding schema...",
        err
      );
      // fall through to rebuild
    }
  }

  // 2️⃣ Study DB again (self-healing)
  const schema = await prisma.$queryRaw`
    SELECT
      table_name,
      column_name,
      data_type
    FROM information_schema.columns
    WHERE table_schema='public'
  `;

  // 3️⃣ Ensure directory exists
  fs.mkdirSync(path.dirname(MEMORY_PATH), { recursive: true });

  // 4️⃣ Save fresh schema
  fs.writeFileSync(
    MEMORY_PATH,
    JSON.stringify(schema, null, 2),
    "utf-8"
  );

  return schema;
}
