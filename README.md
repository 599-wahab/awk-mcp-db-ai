# AWK TLD BOT

AWK TLD BOT is an embeddable AI database assistant for ERP and business apps. It lets users ask questions in Urdu or English, generates safe read-only SQL, queries a connected PostgreSQL database, and returns answers with tables, KPIs, charts, insights, and ERP actions.

## What It Does

- Embeds into another app with one `<script>` tag.
- Opens as a floating chat widget powered by `/widget` and `public/embed.js`.
- Authenticates widget requests with a per-app API key.
- Supports tenant/user context through script attributes.
- Uses a connected app database URL and AI provider settings.
- Generates and validates SELECT-only SQL before running it.
- Auto-detects result views: KPI, table, line, bar, stacked, or pie chart.
- Sends ERP actions back to the host app with `awktld:action` events.
- Supports voice input and browser text-to-speech where available.

## Tech Stack

- Next.js App Router
- React
- Prisma
- PostgreSQL
- NextAuth
- Recharts
- Gemini, OpenAI, Anthropic, LM Studio, and Ollama provider structure

## Important Files

- `public/embed.js` - script pasted into external apps.
- `app/widget/page.tsx` - iframe chat UI.
- `app/api/ai/route.ts` - AI-to-SQL, SQL guard, DB query, response shaping.
- `app/api/widget/register/route.ts` - connected app registration API.
- `app/dashboard/widget-sites/page.tsx` - dashboard UI for creating widget apps.
- `lib/sql-guard.ts` - SQL cleaning and read-only safety checks.
- `lib/memory/schema-loader.ts` - connected database schema caching.
- `prisma/schema.prisma` - users, sessions, connected apps, and chat logs.

## Environment Variables

Create `.env.local`:

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DATABASE?sslmode=require"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="replace-with-a-secure-secret"

GEMINI_API_KEY=""
OPENAI_API_KEY=""
ANTHROPIC_API_KEY=""
```

Per-app Gemini keys can also be stored from the Connected Apps dashboard.

## Local Development

```bash
npm install
npm run dev
```

Open:

```text
http://localhost:3000
```

## Production Build

```bash
npm run build
npm start
```

The build runs `prisma generate` first. If Prisma cannot overwrite files in `node_modules/.prisma/client`, close any running Node/Next process and retry.

## Embedding In Another App

Create a connected app from `/dashboard/widget-sites`, then paste the generated snippet before `</body>` in the host ERP:

```html
<script
  src="https://awk-tld-bot.vercel.app/embed.js"
  data-api-key="YOUR_CONNECTED_APP_API_KEY"
  data-widget-mode="erp"
  data-tenant-id="ERP_TENANT_ID"
  data-user-id="ERP_USER_ID"
  data-user-email="USER_EMAIL"
></script>
```

### Script Attributes

- `data-api-key` - required connected app API key.
- `data-widget-mode` - `erp` for ERP-safe behavior or `general`.
- `data-tenant-id` - optional tenant/company/workspace id.
- `data-user-id` - optional current ERP user id.
- `data-user-email` - optional current ERP user email.

## Host App Action Events

The widget can send actions to the host app. Listen for them like this:

```js
window.addEventListener("awktld:action", (event) => {
  const action = event.detail;

  if (action.type === "navigate") {
    window.location.href = action.href;
  }

  if (action.type === "open_record") {
    console.log("Open record:", action.entity, action.id, action.payload);
  }
});
```

Supported action types:

- `navigate`
- `open_record`
- `show_summary`
- `clarify`

## Security Notes

- API requests require a connected app API key.
- SQL is cleaned and blocked unless it starts with `SELECT`.
- Dangerous SQL keywords like `DROP`, `DELETE`, `INSERT`, `UPDATE`, and `ALTER` are blocked.
- ERP mode can apply tenant/user scoping if the connected schema has matching columns.
- Do not expose database URLs or AI keys in frontend code.
- Store production secrets only in environment variables or protected database fields.

## Current Production Status

Verified:

- `npm run build` passes.
- `app/widget/page.tsx`, `app/api/widget/register/route.ts`, and `public/embed.js` pass ESLint individually.

Known work before calling the whole repo fully production-clean:

- Full `npm run lint` still reports existing issues in older files, mostly `any` types, JSX text escaping, and React hook lint rules.
- `middleware.ts` works today but Next.js warns that the middleware convention is deprecated in favor of `proxy`.
- `package.json#prisma` works today but Prisma warns that this config style will be removed in Prisma 7.

## Deployment Checklist

- Set `DATABASE_URL`, `NEXTAUTH_URL`, and `NEXTAUTH_SECRET`.
- Run Prisma migrations against the production database.
- Create at least one admin/user account.
- Register each ERP as a Connected App.
- Rebuild schema after adding a connected database.
- Test the generated embed snippet in the host ERP.
- Confirm tenant/user scoping for multi-tenant databases.
- Run `npm run build` before deployment.
