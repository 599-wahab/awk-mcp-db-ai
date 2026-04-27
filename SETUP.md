# AWKT-LD Upgrade — Setup Guide

## اردو + English | Voice + Widget + Auth + Multi-App

---

## What was added

| Feature                     | Files                                                                     |
| --------------------------- | ------------------------------------------------------------------------- |
| Claude AI (replaces Gemini) | `lib/claude.ts`, `app/api/ai/route.ts`                                    |
| Urdu + English voice input  | `lib/voice.ts`, `app/api/voice/stt/route.ts`                              |
| Urdu voice output (TTS)     | `app/api/voice/tts/route.ts`                                              |
| Login / auth dashboard      | `lib/auth.ts`, `app/login/page.tsx`, `app/dashboard/layout.tsx`           |
| Popup widget (embed.js)     | `public/embed.js`, `app/widget/page.tsx`                                  |
| Multi-app registration      | `app/api/widget/register/route.ts`, `app/dashboard/widget-sites/page.tsx` |
| Route protection            | `middleware.ts`                                                           |

---

## Step 1 — Install new packages

```bash
npm install next-auth@beta @auth/prisma-adapter bcryptjs @anthropic-ai/sdk
npm install -D @types/bcryptjs
```

Remove the old Gemini package:

```bash
npm uninstall @google/genai
```

---

## Step 2 — Environment variables

Copy `.env.example` → `.env.local` and fill in:

```
ANTHROPIC_API_KEY=sk-ant-...        # from console.anthropic.com
OPENAI_API_KEY=sk-...               # from platform.openai.com (Whisper STT)
GOOGLE_TTS_API_KEY=AIza...          # from console.cloud.google.com (TTS)
NEXTAUTH_SECRET=...                 # openssl rand -base64 32
NEXTAUTH_URL=https://your-app.vercel.app
DATABASE_URL=postgresql://...
MCP_API_KEY=erp-system-123
```

**On Vercel:** Settings → Environment Variables → add all of the above.

---

## Step 3 — Database migration

Add the new models (`User`, `WidgetSite`, `Session`, `Account`) to your
existing `prisma/schema.prisma` file (copy from the provided schema file).

Then run:

```bash
npx prisma migrate dev --name add_widget_auth
npx prisma generate
```

---

## Step 4 — Create your first admin user

```bash
npx ts-node prisma/seed.ts
```

This creates: `admin@awkt.app` / `ChangeMe123!`

Change the password on first login via your DB or add a change-password page.

---

## Step 5 — Google Cloud TTS setup (Urdu voice)

1. Go to https://console.cloud.google.com
2. Create a project (or use existing)
3. Enable **Cloud Text-to-Speech API**
4. Go to **APIs & Services → Credentials**
5. Create API Key → restrict to **Cloud Text-to-Speech API**
6. Copy key → `GOOGLE_TTS_API_KEY` in your env

**Urdu voice used:** `ur-PK-Standard-A` (Pakistani female, clear Urdu)

---

## Step 6 — Deploy to Vercel

```bash
git add .
git commit -m "feat: claude + voice + auth + widget"
git push
```

Vercel will auto-deploy. Make sure all env vars are set in Vercel dashboard.

---

## Step 7 — Connect your other apps (popup widget)

1. Log in to your AWKT-LD dashboard
2. Go to **Connected Apps** in the sidebar
3. Click **Register new app** — enter a name and the URL of your other Vercel app
4. Copy the generated script snippet
5. Paste it in your other app's HTML before `</body>`:

```html
<script
  src="https://your-awkt-app.vercel.app/embed.js"
  data-api-key="abc123def456..."
></script>
```

### Optional: Pass User Identity for Auto-Recognition

To have the widget recognize the logged-in ERP user, add user attributes:

```html
<script
  src="https://your-awkt-app.vercel.app/embed.js"
  data-api-key="abc123def456..."
  data-user-id="USER_ID_FROM_YOUR_ERP"
  data-user-email="user@company.com"
></script>
```

This enables:

- Personalized welcome message ("Welcome back, user@company.com!")
- User context passed to AI for better responses
- Chat history tied to the specific user

A floating chat button will appear on that site. When clicked, it opens the
full AWKT-LD chat widget — supporting Urdu voice + English, connected to your
database.

---

## How voice works

### Voice input (اردو بولیں)

1. User holds the mic button
2. Browser records audio via `MediaRecorder`
3. Audio sent to `/api/voice/stt` → OpenAI Whisper
4. Whisper transcribes Urdu/English → text
5. Text is sent to Claude as the question

### Voice output (AI جواب بولتا ہے)

1. Claude returns the explanation in Urdu/English
2. Text detected as Urdu or English automatically
3. Sent to `/api/voice/tts` → Google Cloud TTS
4. Pakistani Urdu voice (`ur-PK-Standard-A`) plays back

Toggle voice replies on/off using the checkbox in the chat header.

---

## File structure after upgrade

```
app/
├── api/
│   ├── ai/route.ts           ← Updated: Claude + bilingual
│   ├── auth/[...nextauth]/   ← NEW: NextAuth handler
│   ├── health/route.ts       ← Updated: Claude ping
│   ├── voice/
│   │   ├── stt/route.ts      ← NEW: Whisper STT
│   │   └── tts/route.ts      ← NEW: Google TTS
│   └── widget/
│       └── register/route.ts ← NEW: App registration
├── components/
│   ├── chat/ChatBox.tsx      ← Updated: mic button + voice
│   └── layout/
│       ├── Header.tsx        ← Updated: session + logout
│       └── Sidebar.tsx       ← Updated: Connected Apps link
├── dashboard/
│   ├── layout.tsx            ← NEW: auth-protected layout
│   ├── page.tsx              ← NEW: dashboard home
│   └── widget-sites/page.tsx ← NEW: manage connected apps
├── login/page.tsx            ← NEW: bilingual login
└── widget/page.tsx           ← NEW: popup iframe UI
lib/
├── auth.ts                   ← NEW: NextAuth config
├── claude.ts                 ← NEW: Claude API wrapper
└── voice.ts                  ← NEW: VoiceRecorder + speak()
middleware.ts                 ← NEW: route protection
prisma/
├── schema.prisma             ← Updated: User + WidgetSite
└── seed.ts                   ← NEW: first admin user
public/
└── embed.js                  ← NEW: script tag widget
.env.example                  ← NEW: all env vars listed
```

---

## Troubleshooting

**Mic not working in widget (iframe):**
The iframe needs `allow="microphone"`. This is already set in `embed.js`.
Your browser will still prompt for microphone permission on first use.

**Urdu text not rendering correctly:**
Add `dir="auto"` to your message containers in `MessageBubble.tsx`:

```tsx
<p dir="auto" className="mb-2 whitespace-pre-wrap">
  {message.content}
</p>
```

**Widget not showing on external site:**
Check browser console for CORS errors. The middleware sets CORS headers for
`/api/ai` and `/api/voice`. Make sure `NEXTAUTH_URL` is set to your actual
production domain.

**Claude not responding in Urdu:**
Make sure you're using `askClaudeForExplanation` (not `askClaudeForSQL`) for
the human-readable response. The SQL route always returns English SQL, but the
explanation route detects language and responds accordingly.
