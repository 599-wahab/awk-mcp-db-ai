export function buildSqlPrompt(question: string, schema: string): string {
  return `You are a careful PostgreSQL data assistant. Convert the user request into one safe read-only SELECT query.

DATABASE SCHEMA:
${schema}

USER REQUEST:
${question}

STRICT RULES:
1. Return only the raw SQL query. No markdown, no backticks, no comments, no explanation.
2. Use SELECT only. Never use INSERT, UPDATE, DELETE, DROP, CREATE, ALTER, TRUNCATE, GRANT, REVOKE, COPY, EXEC, or stored procedures.
3. Use only tables and columns that exist in the schema. Do not invent names.
4. If tenant, company, user, or scope filters are provided in the request or schema hint, include them on every relevant table.
5. Never select password, token, secret, key, hash, OTP, session, or connection-string columns.
6. Prefer explicit column lists instead of SELECT *.
7. Add LIMIT 100 unless the query is a pure count/sum/aggregate with no row list.
8. Exclude soft-deleted records when a name/title field starts with [DELETED] or a deleted/is_deleted/deleted_at column exists.
9. For names, emails, phone numbers, invoice numbers, product codes, task titles, and customer names, use ILIKE when the column type is text-like.
10. For "pending", "remaining", or "open" tasks, use the real status/completed/is_done columns in the schema.
11. For revenue, sales, payment, amount, balance, or total questions, choose real numeric money columns from the schema.
12. If several tables could match, choose the safest table based on foreign keys and names. Do not join unrelated tables.
13. For record lookup requests such as find, search, locate, open, "show me where", "who is X", or pronoun follow-ups, always include the row id plus safe display fields.
14. Staff lookups should select available fields from: id, employee_id, full_name, designation, department, email, phone, address, is_active.
15. Product lookups should select available fields from: id, product_id_code, product_id, product_code, name, product_name, category, material, finish, is_active.
16. Customer lookups should select available fields from: id, customer_code, company_name, contact_name, customer_name, email, phone, city, address, is_active.
17. Task lookups should select available fields from: id, task_id, title, status, priority, assigned_to_staff, assigned_to_team.
18. Invoice lookups should select available fields from: id, invoice_number, invoice_ref, invoice_no, status, total_amount, total, customer_id.
19. For follow-up pronouns like "show me where he is", use the previous context/result/action to query the same record by id when available.
20. If the request is navigation/help/non-data, or a valid query cannot be written from this schema, return exactly: SELECT 'UNABLE_TO_QUERY' AS error

SQL:`;
}

export function buildExplanationPrompt(
  question: string,
  result: Array<Record<string, unknown>>,
): string {
  return `Explain these database results to the user in 1-3 short, practical sentences.

Match the user's language when clear. If the result is empty, say that no matching records were found and suggest one useful filter to try.
Never include SQL, query text, API keys, credentials, tokens, or connection strings in the answer.

User request:
${question}

Result sample:
${JSON.stringify(result.slice(0, 10))}

Total rows returned: ${result.length}

Answer:`;
}

export function buildFixSqlPrompt(
  sql: string,
  error: string,
  schema: string,
): string {
  return `Fix this PostgreSQL SELECT query.

SCHEMA:
${schema}

BROKEN SQL:
${sql}

ERROR:
${error}

RULES:
1. Return only the corrected raw SQL query.
2. SELECT only. No writes, comments, markdown, or multiple statements.
3. Use only tables and columns from the schema.
4. Preserve required tenant, company, user, or scope filters.
5. Never select password, token, secret, key, hash, OTP, session, or connection-string columns.
6. If the request cannot be answered safely with this schema, return exactly: SELECT 'UNABLE_TO_QUERY' AS error

FIXED SQL:`;
}
