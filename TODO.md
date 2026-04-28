# TypeScript Error Fixes

## Steps

- [ ] Fix `app/api/ai/route.ts` — extract `tenant_id`/`chatHistory` from body, fix syntax error (dangling catch after runQuery function)
- [ ] Fix `app/components/layout/DashboardShell.tsx` — add missing `isUr` variable
- [ ] Fix `app/dashboard/page.tsx` — add `useCallback` import, `inputRef`, remove extra `</div>`
- [ ] Fix `app/dashboard/settings/page.tsx` — add missing state/hooks/components (`isUr`, password states, `Section`, `INPUT`, etc.)
