// lib/sql-guard.ts

const BLOCKED = [
  /\bDROP\b/i,
  /\bDELETE\b/i,
  /\bTRUNCATE\b/i,
  /\bUPDATE\b/i,
  /\bINSERT\b/i,
  /\bALTER\b/i,
  /\bCREATE\b/i,
  /\bGRANT\b/i,
  /\bREVOKE\b/i,
  /\bEXEC\b/i,
  /\bEXECUTE\b/i,
  /--/,
  /\/\*/,
];

// Cleans AI output — removes markdown backticks, "sql" prefix, extra whitespace
export function cleanSQL(raw: string): string {
  return raw
    .replace(/```sql/gi, "")
    .replace(/```/g, "")
    .replace(/^sql\s*/i, "")
    .trim();
}

export function isSafeSQL(sql: string): boolean {
  if (!sql || !sql.trim().toUpperCase().startsWith("SELECT")) return false;
  return !BLOCKED.some((pattern) => pattern.test(sql));
}