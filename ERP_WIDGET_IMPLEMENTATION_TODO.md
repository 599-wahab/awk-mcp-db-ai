# ERP Widget Implementation TODO

This file is the long-term handoff document for the AWK TLD ERP widget and bot integration.
Use it as the single source of truth when asking any LLM to build, update, refactor, or audit this feature in the future.

## Project Goal

Make the AI widget behave as a safe ERP assistant, not a general-purpose database chatbot.

It must:

- Answer only within the logged-in user's valid ERP scope
- Respect tenant isolation at all times
- Help users navigate to the correct ERP page
- Help users find the correct ERP record
- Show safe summaries for invoices, customers, products, staff, teams, tasks, and reports
- Never perform destructive or privileged actions silently

## Current Architecture

### AI Widget App

This repo is the widget/bot service.

Relevant files in this repo:

- [app/api/ai/route.ts](/abs/path/c:/Users/SE/Videos/code/ai-erp-analytics/app/api/ai/route.ts)
- [app/api/widget/register/route.ts](/abs/path/c:/Users/SE/Videos/code/ai-erp-analytics/app/api/widget/register/route.ts)
- [app/widget/page.tsx](/abs/path/c:/Users/SE/Videos/code/ai-erp-analytics/app/widget/page.tsx)
- [app/dashboard/widget-sites/page.tsx](/abs/path/c:/Users/SE/Videos/code/ai-erp-analytics/app/dashboard/widget-sites/page.tsx)
- [public/embed.js](/abs/path/c:/Users/SE/Videos/code/ai-erp-analytics/public/embed.js)

### AWK TLD ERP App

The ERP is a separate Next.js App Router multi-tenant SaaS.

Known ERP structure:

- `src/app/dashboard/...`
- `src/components/AwktBot.tsx`
- `src/app/dashboard/layout.tsx`
- `src/hooks/useSettingsData.ts`
- `src/components/layout/Sidebar.tsx`

Primary ERP modules:

- Dashboard
- Inventory
- Products
- Sales
- Purchases
- Customers
- Staff
- Teams
- Tasks
- My Tasks
- Reports
- Notifications
- Invoices
- Settings

## Business Rules

### Tenant Isolation

Tenant isolation is mandatory.

- Every ERP data answer must stay inside the signed-in tenant
- Never answer across tenants
- Never guess tenant identity
- If scope is missing, refuse safely

### User Scope

Some apps use:

- one database per customer

Some apps use:

- one database shared by many tenants

Some apps may additionally require user-level filtering.

Supported scope modes:

- `database`
- `tenant`
- `user`
- `hybrid`
- `auto`

Definitions:

- `database`: one isolated database per ERP customer; no tenant filter required in SQL
- `tenant`: filter by tenant column such as `tenant_id`
- `user`: filter by user column such as `user_id`
- `hybrid`: apply both tenant and user filters
- `auto`: detect the best supported filter from schema + configured columns

### Allowed Bot Behavior

- Navigate to a known safe ERP page
- Find a specific record
- Show a short safe summary
- Ask the user to choose when multiple matches exist
- Explain where a feature lives

### Disallowed Bot Behavior

- Delete anything
- Create invoices, sales, purchases, or stock changes silently
- Update settings silently
- Change permissions or roles
- Reveal API keys, secrets, env vars, or hidden config
- Access another tenant's data
- Act as a database console

## Widget Contract

### Script Tag Required In ERP

The ERP must embed the widget like this:

```html
<script
  src="https://awk-tld-bot.vercel.app/embed.js"
  data-api-key="YOUR_APP_API_KEY"
  data-widget-mode="erp"
  data-tenant-id="CURRENT_TENANT_ID"
  data-user-id="CURRENT_USER_ID"
  data-user-email="CURRENT_USER_EMAIL"
></script>
```

Required meaning:

- `data-api-key`: identifies the registered connected app
- `data-widget-mode="erp"`: enables ERP-safe behavior
- `data-tenant-id`: logged-in ERP tenant id for multi-tenant systems
- `data-user-id`: logged-in ERP user id
- `data-user-email`: logged-in ERP user email

### Widget Request Payload

The widget sends:

- `question`
- `tenant_id`
- `userId`
- `userEmail`
- `widgetMode`
- `chatHistory`

### Widget Response Contract

The API may return:

```ts
type BotAction =
  | { type: "navigate"; href: string; label?: string }
  | {
      type: "open_record";
      entity: "invoice" | "product" | "customer" | "staff" | "team" | "task";
      id: string;
      label?: string;
      href?: string;
      payload?: Record<string, unknown>;
    }
  | { type: "show_summary"; entity: string; payload: Record<string, unknown> }
  | { type: "clarify"; question: string; options?: string[] };
```

### Widget Action Event Contract

The iframe posts this message to the ERP host page:

```ts
{
  type: "AWKTLD_WIDGET_ACTION",
  action: BotAction
}
```

The embed script also re-emits:

- browser event: `awktld:action`
- optional callback: `window.AWKTLDWidget.onAction(action)`

## ERP-Side Required Work

These items still need to exist in the ERP itself.

### 1. Pass Real Session Context

The ERP must always pass:

- current tenant id
- current user id
- current user email

Best source:

- authenticated session / server-resolved user context

Avoid relying only on:

- localStorage

### 2. Handle Widget Actions

The ERP must listen for widget actions and route them into the correct page.

Example:

```ts
window.addEventListener("awktld:action", (event: any) => {
  const action = event.detail;

  if (action.type === "navigate" && action.href) {
    window.location.href = action.href;
    return;
  }

  if (action.type === "open_record") {
    if (action.entity === "invoice") {
      window.location.href = `/dashboard/invoices?id=${action.id}`;
      return;
    }

    if (action.entity === "customer") {
      window.location.href = `/dashboard/customers?id=${action.id}`;
      return;
    }

    if (action.entity === "product") {
      window.location.href = `/dashboard/products?id=${action.id}`;
      return;
    }

    if (action.entity === "task") {
      window.location.href = `/dashboard/tasks?id=${action.id}`;
      return;
    }
  }
});
```

### 3. Support Route Filters Or Search Params

ERP pages should accept query params and auto-open/filter records.

Recommended patterns:

- `/dashboard/invoices?id=...`
- `/dashboard/invoices?invoice=INV-1024`
- `/dashboard/customers?id=...`
- `/dashboard/products?id=...`
- `/dashboard/products?code=AWK-F-0012`
- `/dashboard/tasks?id=...`
- `/dashboard/staff?id=...`

### 4. Add Role Checks In ERP UI

Before opening a page or showing detail fields, ERP UI must check:

- current user role
- current user permissions
- field visibility rules

If restricted:

- refuse gracefully
- do not render hidden values

### 5. Add Safe Record Lookup Helpers In ERP

Prefer dedicated ERP endpoints or helpers instead of raw AI SQL guessing.

Recommended ERP lookup helpers:

- `findInvoice(tenantId, query, userContext)`
- `findProduct(tenantId, query, userContext)`
- `findCustomer(tenantId, query, userContext)`
- `findStaff(tenantId, query, userContext)`
- `findTask(tenantId, query, userContext)`

Each helper should:

- search only inside the tenant
- respect user role restrictions
- return top 3 matches
- return only safe display fields
- support disambiguation

## Route Map

Recommended ERP route map:

```ts
const BOT_ROUTES = {
  dashboard: "/dashboard",
  inventory: "/dashboard/inventory",
  products: "/dashboard/products",
  sales: "/dashboard/sales",
  purchases: "/dashboard/purchases",
  customers: "/dashboard/customers",
  staff: "/dashboard/staff",
  teams: "/dashboard/teams",
  tasks: "/dashboard/tasks",
  myTasks: "/dashboard/my-tasks",
  reports: "/dashboard/reports",
  notifications: "/dashboard/notifications",
  invoices: "/dashboard/invoices",
  subscription: "/dashboard/subscription",
  settings: "/dashboard/settings",
};
```

## Entity Detail Rules

### Invoice

Allowed:

- invoice number
- customer name
- date
- total
- paid/unpaid status
- due amount

Avoid:

- hidden internal ids unless UI already exposes them

### Product

Allowed:

- product name
- product code
- barcode
- stock quantity
- category
- sale price
- cost price only if current role may view it

### Customer

Allowed:

- company name
- contact name
- phone
- email
- balance
- payment terms
- recent transaction summary

### Staff

Allowed:

- full name
- employee id
- role/designation
- shift
- attendance summary

### Task

Allowed:

- title
- assignee
- status
- priority
- deadline

## Current Widget Service Changes Already Done

These are already implemented in this repo:

### API

- stronger tenant/user scope resolution in `app/api/ai/route.ts`
- ERP widget mode enforcement
- scope modes using app config
- structured ERP actions in API responses
- refusal when ERP widget scope should exist but cannot be applied

### Widget

- widget sends tenant/user/widget context
- widget sends chat history
- widget renders action buttons
- widget posts actions back to ERP host

### Connected Apps

- connected app stores `contextJson`
- UI supports widget mode + scope mode + tenant/user column config
- embed snippet now includes ERP-related attributes

## Connected App Configuration Guidance

For AWK TLD ERP, recommended default connected app config:

- `widgetMode`: `erp`
- `dataScope.mode`: `tenant`
- `dataScope.tenantColumn`: `tenant_id`
- `dataScope.userColumn`: `user_id`

If AWK TLD ERP restricts records further per user:

- use `hybrid`

If a customer gets a dedicated isolated database:

- use `database`

## AWK TLD ERP-Specific Notes

AWK TLD ERP is a multi-tenant SaaS ERP.

Known important tables:

- `tenants`
- `user_profiles`
- `products`
- `inventory`
- `inventory_logs`
- `customers`
- `customer_transactions`
- `customer_products`
- `staff`
- `teams`
- `tasks`
- `task_notes`
- `messages`
- `notifications`
- `quote_requests`

Important ERP-side behavior:

- every query and every bot answer must be tenant-scoped
- bot should focus on safe navigation + lookup + summaries
- bot should not silently mutate business data

## Recommended ERP Implementation Order

1. Ensure real tenant/user context is available in the ERP widget mount point
2. Pass `data-tenant-id`, `data-user-id`, and `data-user-email` into the script tag
3. Add `awktld:action` listener in ERP host app
4. Make invoice/customer/product/task pages accept route query params
5. Add dedicated tenant-safe lookup helpers
6. Add role-aware field filtering
7. Add disambiguation UI for multiple matches
8. Add current-page awareness
9. Add audit logging for bot-triggered navigation

## Concrete ERP TODO

- [ ] Ensure logged-in tenant id is always available from authenticated ERP session
- [ ] Ensure logged-in user id is always available from authenticated ERP session
- [ ] Ensure logged-in user email is always available from authenticated ERP session
- [ ] Update ERP widget embed usage to pass all required data attributes
- [ ] Add ERP-side `awktld:action` event listener
- [ ] Add ERP-side `window.AWKTLDWidget.onAction` fallback handler
- [ ] Support `/dashboard/invoices?id=...`
- [ ] Support `/dashboard/customers?id=...`
- [ ] Support `/dashboard/products?id=...`
- [ ] Support `/dashboard/tasks?id=...`
- [ ] Support invoice number based lookup route param
- [ ] Support product code based lookup route param
- [ ] Add tenant-safe `findInvoice`
- [ ] Add tenant-safe `findProduct`
- [ ] Add tenant-safe `findCustomer`
- [ ] Add tenant-safe `findStaff`
- [ ] Add tenant-safe `findTask`
- [ ] Add multi-match disambiguation flow
- [ ] Add role-aware response filtering
- [ ] Add audit-friendly logging for widget-triggered navigation

## Prompt To Give A Future LLM

Use this prompt with this file:

```text
Read ERP_WIDGET_IMPLEMENTATION_TODO.md first and treat it as the project contract.

Your job is to update the AWK TLD ERP widget integration safely.

Requirements:
- Preserve tenant isolation
- Preserve ERP-safe read-only assistant behavior
- Respect role restrictions
- Use structured widget actions
- Do not add destructive behavior
- Prefer route-safe navigation and dedicated lookup helpers

Before changing code:
- identify current tenant/user context flow
- identify where widget is mounted
- identify how invoices/customers/products/tasks pages can accept query params

When implementing:
- keep changes tenant-safe
- do not invent data
- if multiple records match, require clarification
- avoid broad database access behavior
```

## Final Rule

If future development conflicts with tenant safety, role restrictions, or ERP-safe behavior, choose safety over convenience.
