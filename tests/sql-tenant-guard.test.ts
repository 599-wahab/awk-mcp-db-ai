import test from "node:test";
import assert from "node:assert/strict";
import {
  injectTenantScopeSQL,
  validateTenantScopedSQL,
} from "../lib/sql-guard";

const schema = {
  tables: [
    { table_name: "staff", column_name: "id" },
    { table_name: "staff", column_name: "tenant_id" },
    { table_name: "staff", column_name: "full_name" },
    { table_name: "products", column_name: "tenant_id" },
    { table_name: "tenants", column_name: "id" },
  ],
};

test("Tenant A staff count is scoped to Tenant A", () => {
  const sql = injectTenantScopeSQL({
    sql: "SELECT count(*) FROM staff",
    schema,
    tenantId: "tenant-a",
  });

  assert.match(sql, /staff\.tenant_id = 'tenant-a'/i);
  assert.deepEqual(
    validateTenantScopedSQL({ sql, schema, tenantId: "tenant-a" }),
    { ok: true },
  );
});

test("Tenant B staff count is scoped to Tenant B", () => {
  const sql = injectTenantScopeSQL({
    sql: "SELECT count(*) FROM staff",
    schema,
    tenantId: "tenant-b",
  });

  assert.match(sql, /staff\.tenant_id = 'tenant-b'/i);
  assert.deepEqual(
    validateTenantScopedSQL({ sql, schema, tenantId: "tenant-b" }),
    { ok: true },
  );
});

test("Standalone bot without tenant context is blocked for tenant tables", () => {
  const result = validateTenantScopedSQL({
    sql: "SELECT count(*) FROM staff",
    schema,
    tenantId: null,
  });

  assert.equal(result.ok, false);
});

test("Name search is scoped inside the current tenant", () => {
  const sql = injectTenantScopeSQL({
    sql: "SELECT id, full_name FROM staff WHERE full_name ILIKE '%wahad%'",
    schema,
    tenantId: "tenant-a",
  });

  assert.match(sql, /WHERE staff\.tenant_id = 'tenant-a' AND/i);
  assert.match(sql, /full_name ILIKE '%wahad%'/i);
  assert.deepEqual(
    validateTenantScopedSQL({ sql, schema, tenantId: "tenant-a" }),
    { ok: true },
  );
});

test("SQL without tenant_id on tenant-owned tables is rejected", () => {
  const result = validateTenantScopedSQL({
    sql: "SELECT id, full_name FROM staff",
    schema,
    tenantId: "tenant-a",
  });

  assert.equal(result.ok, false);
});

test("Superadmin explicit global query may bypass tenant filter", () => {
  const result = validateTenantScopedSQL({
    sql: "SELECT count(*) FROM staff",
    schema,
    tenantId: null,
    allowGlobal: true,
  });

  assert.deepEqual(result, { ok: true });
});
