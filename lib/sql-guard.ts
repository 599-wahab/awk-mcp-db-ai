export function isSafeSQL(sql: string): boolean {
  const forbidden = ["DROP", "DELETE", "UPDATE", "INSERT", "ALTER", "TRUNCATE"];
  return !forbidden.some(word =>
    sql.toUpperCase().includes(word)
  );
}
