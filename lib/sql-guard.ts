// lib/sql-guard.ts

const DANGEROUS_KEYWORDS = [
  /\bDROP\b/i,
  /\bDELETE\b/i,
  /\bTRUNCATE\b/i,
  /\bINSERT\b/i,
  /\bUPDATE\b/i,
  /\bALTER\b/i,
  /\bCREATE\b/i,
  /\bGRANT\b/i,
  /\bREVOKE\b/i,
  /\bEXECUTE\b/i,
  /\bEXEC\b/i,
  /\bxp_/i,
  /\bpg_read_file\b/i,
  /\bpg_write_file\b/i,
  /\bCOPY\b.*\bTO\b/i,
  /\bCOPY\b.*\bFROM\b/i,
];

export function isSafeSQL(sql: string): boolean {
  if (!sql || typeof sql !== 'string') return false;

  const trimmed = sql.trim();

  // Must start with SELECT (after optional whitespace/newlines)
  if (!/^\s*SELECT\b/i.test(trimmed)) {
    console.warn('SQL rejected: does not start with SELECT:', trimmed.slice(0, 100));
    return false;
  }

  // Check for dangerous keywords
  for (const pattern of DANGEROUS_KEYWORDS) {
    if (pattern.test(trimmed)) {
      console.warn('SQL rejected: dangerous keyword found:', trimmed.slice(0, 100));
      return false;
    }
  }

  return true;
}

export function cleanSQL(raw: string): string {
  if (!raw) return '';

  let sql = raw.trim();

  // Remove markdown code blocks
  sql = sql.replace(/```sql\s*/gi, '').replace(/```\s*/gi, '');

  // Remove inline backtick wrapping
  sql = sql.replace(/^`+|`+$/g, '');

  // Remove "SQL:" or "SQL query:" prefix labels
  sql = sql.replace(/^(SQL query:|SQL:|Query:)\s*/i, '');

  // Remove trailing semicolons (Prisma $queryRawUnsafe doesn't want them)
  sql = sql.replace(/;\s*$/, '');

  // Collapse extra whitespace
  sql = sql.replace(/\n{3,}/g, '\n\n').trim();

  return sql;
}