# AWK TLD Universal ERP Bot Integration

Share this file with the ERP project when improving the embedded `AwktBot`.

## Goal

The bot must be a safe universal ERP assistant for any connected database schema. It can answer read-only data questions, summarize records, and navigate the ERP. It must never mutate data, reveal secrets, or cross tenant/user scope.

## Hosted Bot Endpoint

```ts
const BOT_API_URL = "https://awk-tld-bot.vercel.app/api/ai";
const ERP_WIDGET_MODE = "erp-dashboard";
```

Required headers:

```text
Content-Type: application/json
X-API-Key: <connected app API key>
X-Widget-Mode: erp-dashboard
X-Tenant-ID: <current tenant id>
X-Company-ID: <current company id, if your ERP uses company instead of tenant>
X-User-ID: <current user id>
X-User-Email: <current user email>
```

Recommended body:

```ts
{
  question: text,
  tenant_id: tenantId,
  company_id: companyId,
  userId,
  userEmail,
  widgetMode: "erp-dashboard",
  currentPath: window.location.pathname + window.location.search,
  chatHistory: recentMessages.map((m) => ({
    content: m.content,
    isUser: m.isUser,
  })),
  erpContext: {
    currentPage,
    locale,
    role,
  },
}
```

## Response Contract

The ERP widget should support all of these fields for backward and forward compatibility:

```ts
type BotApiResponse = {
  response?: string;
  explanation?: string;
  message?: string;
  error?: string;
  errorType?: string;
  sql?: string | null;
  result?: Array<Record<string, unknown>> | null;
  visualization?: "none" | "kpi" | "table" | "line" | "bar" | "pie" | "stacked";
  insights?: string[];
  action?: BotAction | null;
  actions?: BotAction[];
  isClarification?: boolean;
  detectedLang?: "en" | "ur";
  meta?: Record<string, unknown>;
};
```

Pick visible assistant text in this order:

```ts
const assistantText =
  data.response ||
  data.explanation ||
  data.message ||
  data.error ||
  "No response from bot";
```

Normalize actions like this:

```ts
const actions = Array.isArray(data.actions)
  ? data.actions
  : data.action
    ? [data.action]
    : [];
```

## Action Contract

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

## Record Actions

The hosted bot should return explicit `open_record` actions when the user asks to find, search, locate, open, or show a specific ERP record.

Expected behavior:

- `who is Wahad` answers with useful details.
- `find/search/open/locate Wahad` answers and returns `open_record`.
- `show me where he is`, `open it`, or `show that product` uses recent `chatHistory` to resolve the last matching record and returns `open_record`.
- Multiple matches return `clarify` with practical options, not auto-open.
- No matches should say no matching record was found and may include a safe `navigate` action to the relevant module page.

Record lookup SQL rules:

- Staff lookup should select available safe fields from `id`, `employee_id`, `full_name`, `designation`, `department`, `email`, `phone`, `address`, `is_active`.
- Product lookup should select available safe fields from `id`, `product_id_code`, `product_id`, `product_code`, `name`, `product_name`, `category`, `material`, `finish`, `is_active`.
- Customer lookup should select available safe fields from `id`, `customer_code`, `company_name`, `contact_name`, `customer_name`, `email`, `phone`, `city`, `address`, `is_active`.
- Task lookup should select available safe fields from `id`, `task_id`, `title`, `status`, `priority`, `assigned_to_staff`, `assigned_to_team`.
- Invoice lookup should select available safe fields from `id`, `invoice_number`, `invoice_ref`, `invoice_no`, `status`, `total_amount`, `total`, `customer_id`.
- Never use `SELECT *`.
- Always include a `LIMIT`.

Example `open_record` response:

```json
{
  "response": "I found Wahad in Staff. Opening and highlighting the record now.",
  "sql": "SELECT id, employee_id, full_name, designation, department, email, phone FROM staff WHERE tenant_id = 'tenant-id' AND full_name ILIKE '%wahad%' LIMIT 10",
  "result": [
    {
      "id": "staff-id-here",
      "employee_id": "AWK-EMP-108683198",
      "full_name": "Wahad",
      "designation": "manager",
      "department": "Packaging",
      "email": "wahad@gmail.com",
      "phone": "456789"
    }
  ],
  "visualization": "none",
  "insights": [],
  "actions": [
    {
      "type": "open_record",
      "entity": "staff",
      "id": "staff-id-here",
      "label": "Open Wahad"
    }
  ]
}
```

Example multiple-match response:

```json
{
  "response": "I found more than one Wahad. Which one should I open?",
  "actions": [
    {
      "type": "clarify",
      "question": "Which Wahad should I open?",
      "options": ["Wahad - Packaging", "Wahad - Sales"]
    }
  ]
}
```

ERP-side handler:

```ts
function handleBotAction(action: BotAction) {
  if (action.type === "navigate" && action.href.startsWith("/dashboard")) {
    router.push(action.href);
    return;
  }

  if (action.type === "open_record") {
    const routes = {
      invoice: "/dashboard/invoices",
      customer: "/dashboard/customers",
      product: "/dashboard/products",
      task: "/dashboard/tasks",
      staff: "/dashboard/staff",
      team: "/dashboard/teams",
    } as const;

    const base = routes[action.entity];
    if (base) router.push(`${base}?id=${encodeURIComponent(action.id)}`);
    return;
  }

  if (action.type === "clarify") {
    addAssistantMessage(action.question, { quickReplies: action.options || [] });
  }
}
```

## ERP-Side Improvements To Make

1. Always pass real server/session context: `tenantId`, `companyId`, `userId`, `userEmail`, role, and current path.
2. Accept both `action` and `actions`.
3. Add query-param support to ERP pages:
   - `/dashboard/invoices?id=...`
   - `/dashboard/customers?id=...`
   - `/dashboard/products?id=...`
   - `/dashboard/tasks?id=...`
   - `/dashboard/staff?id=...`
   - `/dashboard/teams?id=...`
4. Add quick reply buttons for `clarify.options`.
5. Keep local navigation detection in the ERP widget for instant page opens.
6. Hide SQL in the embedded customer-facing widget unless the logged-in role is admin.
7. Apply ERP role checks before opening pages or showing sensitive fields.

## Universal Database Safety Rules

Configure each connected app with the correct data scope:

```json
{
  "widgetMode": "erp-dashboard",
  "dataScope": {
    "mode": "tenant",
    "tenantColumn": "tenant_id",
    "userColumn": "user_id"
  }
}
```

Use:

- `database` when every customer has a separate isolated database.
- `tenant` when one database contains many tenants/companies.
- `user` when every row belongs directly to one user.
- `hybrid` when both tenant and user filters are mandatory.
- `auto` only during setup/testing; production ERPs should choose an explicit mode.

Never rely only on local storage for tenant/user context. Local storage is useful as a UI fallback, but the API request should be built from authenticated ERP session data.

## Embed.js Snippet

If the ERP uses the hosted iframe embed instead of its own `AwktBot`, use:

```html
<script
  src="https://awk-tld-bot.vercel.app/embed.js"
  data-api-key="YOUR_CONNECTED_APP_API_KEY"
  data-widget-mode="erp-dashboard"
  data-tenant-id="CURRENT_TENANT_ID"
  data-company-id="CURRENT_COMPANY_ID"
  data-user-id="CURRENT_USER_ID"
  data-user-email="CURRENT_USER_EMAIL"
></script>
```

The embed automatically forwards the current ERP path to the hosted widget.

## Final Rule

If a request is missing tenant/user scope, asks for destructive changes, or tries to expose secrets, the ERP should refuse gracefully. Safety beats convenience.
