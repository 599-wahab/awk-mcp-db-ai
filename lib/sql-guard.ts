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

export function isSafeSQL(sql: string): boolean {
  if (!sql || !sql.trim().toUpperCase().startsWith("SELECT")) return false;
  return !BLOCKED.some((pattern) => pattern.test(sql));
}