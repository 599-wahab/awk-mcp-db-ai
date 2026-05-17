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

type SchemaColumn = {
  table_name?: string;
  column_name?: string;
};

type SchemaLike = {
  tables?: SchemaColumn[];
};

type TableRef = {
  table: string;
  alias: string;
};

export function isSafeSQL(sql: string): boolean {
  if (!sql || typeof sql !== 'string') return false;

  const trimmed = sql.trim();

  // Must start with SELECT (after optional whitespace/newlines)
  if (!/^\s*SELECT\b/i.test(trimmed)) {
    console.warn('SQL rejected: does not start with SELECT:', trimmed.slice(0, 100));
    return false;
  }

  // Disallow stacked statements. cleanSQL removes one trailing semicolon, so any
  // remaining semicolon is an attempt to run more than one statement.
  if (trimmed.includes(';')) {
    console.warn('SQL rejected: multiple statements:', trimmed.slice(0, 100));
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

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeIdentifier(value: string): string {
  return value.replace(/"/g, "").split(".").pop()?.toLowerCase() || "";
}

function quoteIdentifier(value: string): string {
  if (/^[a-z_][a-z0-9_]*$/i.test(value)) return value;
  return `"${value.replace(/"/g, '""')}"`;
}

function escapeSqlLiteral(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

function getTenantOwnedTables(
  schema: SchemaLike,
  tenantColumn = "tenant_id",
): Set<string> {
  const owned = new Set<string>();
  for (const column of schema.tables || []) {
    if (
      column.table_name &&
      column.column_name?.toLowerCase() === tenantColumn.toLowerCase()
    ) {
      owned.add(column.table_name.toLowerCase());
    }
  }
  return owned;
}

function extractTableRefs(sql: string): TableRef[] {
  const refs: TableRef[] = [];
  const re =
    /\b(?:FROM|JOIN)\s+((?:"?[a-zA-Z_][\w]*"?\.)?"?[a-zA-Z_][\w]*"?)(?:\s+(?:AS\s+)?("?[a-zA-Z_][\w]*"?))?/gi;
  const reserved = new Set([
    "where",
    "join",
    "left",
    "right",
    "inner",
    "outer",
    "full",
    "cross",
    "on",
    "group",
    "order",
    "limit",
    "having",
    "union",
  ]);

  for (const match of sql.matchAll(re)) {
    const table = normalizeIdentifier(match[1]);
    const alias = normalizeIdentifier(match[2] || table);
    if (!table || reserved.has(table)) continue;
    refs.push({ table, alias: reserved.has(alias) ? table : alias });
  }

  return refs;
}

function tenantPredicatePattern(args: {
  alias: string;
  tenantColumn: string;
  tenantId: string;
}) {
  const alias = escapeRegExp(args.alias);
  const column = escapeRegExp(args.tenantColumn);
  const tenantId = escapeRegExp(args.tenantId.replace(/'/g, "''"));
  return new RegExp(
    `(?:\\b${alias}\\s*\\.\\s*)?\\b${column}\\b\\s*=\\s*'${tenantId}'`,
    "i",
  );
}

function hasTenantPredicate(sql: string, ref: TableRef, tenantColumn: string) {
  const alias = escapeRegExp(ref.alias);
  const table = escapeRegExp(ref.table);
  const column = escapeRegExp(tenantColumn);
  return new RegExp(
    `(?:\\b${alias}\\s*\\.\\s*|\\b${table}\\s*\\.\\s*)?\\b${column}\\b\\s*=`,
    "i",
  ).test(sql);
}

function insertWhereCondition(sql: string, condition: string): string {
  if (/\bWHERE\b/i.test(sql)) {
    return sql.replace(/\bWHERE\b/i, `WHERE ${condition} AND `);
  }

  for (const keyword of ["GROUP BY", "ORDER BY", "LIMIT", "HAVING"]) {
    const re = new RegExp(`\\b${keyword}\\b`, "i");
    if (re.test(sql)) {
      return sql.replace(re, `WHERE ${condition} ${keyword}`);
    }
  }

  return sql.replace(/;?\s*$/, ` WHERE ${condition}`);
}

export function injectTenantScopeSQL(args: {
  sql: string;
  schema: SchemaLike;
  tenantId: string;
  tenantColumn?: string;
}): string {
  const tenantColumn = args.tenantColumn || "tenant_id";
  const ownedTables = getTenantOwnedTables(args.schema, tenantColumn);
  if (!ownedTables.size) return args.sql;

  const conditions = extractTableRefs(args.sql)
    .filter((ref) => ownedTables.has(ref.table))
    .filter((ref) => !hasTenantPredicate(args.sql, ref, tenantColumn))
    .map((ref) => {
      const qualifier = quoteIdentifier(ref.alias || ref.table);
      return `${qualifier}.${quoteIdentifier(tenantColumn)} = ${escapeSqlLiteral(args.tenantId)}`;
    });

  if (!conditions.length) return args.sql;
  return insertWhereCondition(args.sql, conditions.join(" AND "));
}

export function validateTenantScopedSQL(args: {
  sql: string;
  schema: SchemaLike;
  tenantId?: string | null;
  tenantColumn?: string;
  allowGlobal?: boolean;
}): { ok: true } | { ok: false; reason: string; tables: string[] } {
  const tenantColumn = args.tenantColumn || "tenant_id";
  const ownedTables = getTenantOwnedTables(args.schema, tenantColumn);
  const refs = extractTableRefs(args.sql).filter((ref) =>
    ownedTables.has(ref.table),
  );

  if (!refs.length) return { ok: true };
  if (args.allowGlobal) return { ok: true };

  if (!args.tenantId) {
    return {
      ok: false,
      reason: "Missing tenant context for tenant-owned tables.",
      tables: [...new Set(refs.map((ref) => ref.table))],
    };
  }

  const missing = refs.filter(
    (ref) =>
      !tenantPredicatePattern({
        alias: ref.alias,
        tenantColumn,
        tenantId: args.tenantId!,
      }).test(args.sql),
  );

  if (missing.length) {
    return {
      ok: false,
      reason: "Tenant-owned query is missing the required tenant_id filter.",
      tables: [...new Set(missing.map((ref) => ref.table))],
    };
  }

  return { ok: true };
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
