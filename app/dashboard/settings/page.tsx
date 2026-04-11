"use client";
// app/settings/page.tsx — Full settings: AI provider, DB, language, text size, change password

import { useState, useEffect } from "react";

const PROVIDERS: Record<string, {
  label: string; needsKey: boolean; defaultModel: string;
  models: string[]; keyHint: string; placeholder: string; defaultUrl?: string;
}> = {
  GEMINI:    { label: "Google Gemini (Free)", needsKey: true,  defaultModel: "gemini-1.5-flash",       models: ["gemini-1.5-flash","gemini-1.5-pro","gemini-2.0-flash-exp"],    keyHint: "Get free key at aistudio.google.com", placeholder: "AIzaSy..." },
  OPENAI:    { label: "OpenAI (ChatGPT)",     needsKey: true,  defaultModel: "gpt-3.5-turbo",          models: ["gpt-3.5-turbo","gpt-4o-mini","gpt-4o"],                        keyHint: "Get key at platform.openai.com",      placeholder: "sk-..." },
  ANTHROPIC: { label: "Anthropic Claude",     needsKey: true,  defaultModel: "claude-3-haiku-20240307",models: ["claude-3-haiku-20240307","claude-3-5-sonnet-20241022"],        keyHint: "Get key at console.anthropic.com",    placeholder: "sk-ant-..." },
  LMSTUDIO:  { label: "LM Studio (Local 🆓)", needsKey: false, defaultModel: "local-model",            models: [],                                                              keyHint: "No key needed — runs locally", placeholder: "", defaultUrl: "http://localhost:1234/v1" },
  OLLAMA:    { label: "Ollama (Local 🆓)",    needsKey: false, defaultModel: "gemma:2b",               models: ["gemma:2b","llama2","mistral","codellama"],                      keyHint: "No key needed — install ollama.ai",   placeholder: "", defaultUrl: "http://localhost:11434" },
};

interface App { id: string; name: string; apiKey: string; dbType: string; }

function Section({ title }: { title: string }) {
  return (
    <div className="fm text-[10px] text-[#e8ff47] uppercase tracking-widest pt-2 pb-1 border-b border-[#1e1e1e] mb-4">
      // {title}
    </div>
  );
}

export default function SettingsPage() {
  // ── App settings state ───────────────────────────────────────────────────
  const [apps, setApps]           = useState<App[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [dbUrl, setDbUrl]         = useState("");
  const [apiKey, setApiKey]       = useState("");
  const [aiProvider, setAiProvider] = useState("GEMINI");
  const [aiModel, setAiModel]     = useState("");
  const [aiBaseUrl, setAiBaseUrl] = useState("");
  const [appSaving, setAppSaving] = useState(false);
  const [appSaved, setAppSaved]   = useState(false);
  const [appError, setAppError]   = useState("");

  // ── User prefs state ─────────────────────────────────────────────────────
  const [prefLang, setPrefLang]   = useState("auto");
  const [textSize, setTextSize]   = useState("md");
  const [prefSaving, setPrefSaving] = useState(false);
  const [prefSaved, setPrefSaved] = useState(false);

  // ── Password state ───────────────────────────────────────────────────────
  const [currPw, setCurrPw]       = useState("");
  const [newPw, setNewPw]         = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwSaving, setPwSaving]   = useState(false);
  const [pwMsg, setPwMsg]         = useState<{ text: string; ok: boolean } | null>(null);

  useEffect(() => {
    fetch("/api/widget/register").then(r => r.json()).then(data => {
      if (Array.isArray(data) && data.length > 0) { setApps(data); setSelectedId(data[0].id); }
    }).catch(() => {});
    fetch("/api/user-preferences").then(r => r.json()).then(d => {
      if (d.preferredLang) setPrefLang(d.preferredLang);
      if (d.textSize)      setTextSize(d.textSize);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    fetch(`/api/settings?appId=${selectedId}`).then(r => r.json()).then(d => {
      setDbUrl(d.dbUrl || "");
      setApiKey(d.apiKey || "");
      setAiProvider(d.aiProvider || "GEMINI");
      setAiModel(d.aiModel || "");
      setAiBaseUrl(d.aiBaseUrl || "");
    }).catch(() => {});
  }, [selectedId]);

  useEffect(() => {
    const info = PROVIDERS[aiProvider];
    if (info?.defaultUrl && !aiBaseUrl) setAiBaseUrl(info.defaultUrl);
  }, [aiProvider]);

  async function saveApp() {
    if (!selectedId) return;
    setAppSaving(true); setAppError("");
    const res = await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ appId: selectedId, dbUrl, apiKey, aiProvider, aiModel, aiBaseUrl }),
    });
    const d = await res.json();
    if (d.success) { setAppSaved(true); setTimeout(() => setAppSaved(false), 3000); }
    else setAppError(d.error || "Save failed");
    setAppSaving(false);
  }

  async function savePrefs() {
    setPrefSaving(true);
    await fetch("/api/user-preferences", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ preferredLang: prefLang, textSize }),
    });
    setPrefSaved(true);
    setTimeout(() => setPrefSaved(false), 3000);
    setPrefSaving(false);
  }

  async function changePassword() {
    if (newPw !== confirmPw) { setPwMsg({ text: "Passwords do not match", ok: false }); return; }
    if (newPw.length < 6)    { setPwMsg({ text: "Min 6 characters", ok: false }); return; }
    setPwSaving(true); setPwMsg(null);
    const res = await fetch("/api/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword: currPw, newPassword: newPw }),
    });
    const d = await res.json();
    if (d.success) {
      setPwMsg({ text: "✓ Password changed successfully", ok: true });
      setCurrPw(""); setNewPw(""); setConfirmPw("");
    } else {
      setPwMsg({ text: d.error || "Failed", ok: false });
    }
    setPwSaving(false);
  }

  const info        = PROVIDERS[aiProvider];
  const selectedApp = apps.find(a => a.id === selectedId);
  const isUr        = prefLang === "ur";

  const INPUT = "w-full bg-black border border-[#1e1e1e] text-white px-4 py-3 text-sm focus:outline-none focus:border-[#e8ff47] transition-colors";

  return (
    <div className="max-w-2xl space-y-8 pb-12" style={{ fontFamily: "'DM Sans',sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Space+Mono:wght@400;700&family=DM+Sans:wght@300;400;500;600&display=swap');
        .fd{font-family:'Bebas Neue',sans-serif;} .fm{font-family:'Space Mono',monospace;}
      `}</style>

      {/* Header */}
      <div>
        <div className="fm text-xs text-[#e8ff47] uppercase tracking-widest mb-2">// Settings</div>
        <h1 className="fd text-4xl tracking-wide text-white">{isUr ? "ترتیبات" : "APP SETTINGS"}</h1>
        <p className="text-[#5a5a5a] text-sm mt-1">
          {isUr ? "ڈیٹا بیس، AI، زبان اور پاس ورڈ کی ترتیبات" : "Configure database, AI provider, language and account settings."}
        </p>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          SECTION 1 — App (DB + AI provider)
      ════════════════════════════════════════════════════════════════════ */}
      <div className="border border-[#1e1e1e] bg-[#0d0d0d]">
        <div className="px-5 py-4 border-b border-[#1e1e1e]">
          <Section title={isUr ? "ایپ کی ترتیبات" : "App Configuration"} />
        </div>
        <div className="p-5 space-y-5">
          {apps.length === 0 ? (
            <p className="text-sm text-[#5a5a5a]">
              No apps yet. <a href="/dashboard/widget-sites" className="text-[#e8ff47]">Create one →</a>
            </p>
          ) : (
            <>
              {/* App selector */}
              <div>
                <label className="fm block text-[10px] text-[#5a5a5a] uppercase tracking-wider mb-1.5">
                  {isUr ? "ایپ منتخب کریں" : "Select App"}
                </label>
                <select value={selectedId} onChange={e => setSelectedId(e.target.value)} className={INPUT}>
                  {apps.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>

              {/* Widget API Key */}
              {selectedApp && (
                <div>
                  <label className="fm block text-[10px] text-[#5a5a5a] uppercase tracking-wider mb-1.5">
                    {isUr ? "ویجٹ API کی (صرف پڑھنے کے لیے)" : "Widget API Key (read only)"}
                  </label>
                  <div className="flex gap-2">
                    <code className="flex-1 bg-black border border-[#1e1e1e] text-[#e8ff47] px-4 py-2.5 text-xs truncate">{selectedApp.apiKey}</code>
                    <button onClick={() => navigator.clipboard.writeText(selectedApp.apiKey)}
                      className="fm text-xs border border-[#1e1e1e] text-[#5a5a5a] px-3 hover:border-[#e8ff47] hover:text-[#e8ff47] transition-colors">
                      Copy
                    </button>
                  </div>
                </div>
              )}

              {/* Database URL */}
              <div>
                <label className="fm block text-[10px] text-[#5a5a5a] uppercase tracking-wider mb-1.5">
                  {isUr ? "ڈیٹا بیس URL *" : "Database URL *"}
                </label>
                <textarea value={dbUrl} onChange={e => setDbUrl(e.target.value)} rows={2} dir="ltr"
                  placeholder="postgresql://user:pass@host/db?sslmode=require"
                  className={INPUT + " resize-none font-mono"} />
              </div>

              {/* AI Provider */}
              <div>
                <label className="fm block text-[10px] text-[#5a5a5a] uppercase tracking-wider mb-1.5">
                  {isUr ? "AI فراہم کنندہ *" : "AI Provider *"}
                </label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {Object.entries(PROVIDERS).map(([key, p]) => (
                    <button key={key} onClick={() => setAiProvider(key)}
                      className={`fm text-[10px] px-3 py-2.5 border text-left transition-colors ${
                        aiProvider === key
                          ? "border-[#e8ff47] text-[#e8ff47] bg-[#e8ff47]/5"
                          : "border-[#1e1e1e] text-[#5a5a5a] hover:border-[#2a2a2a]"
                      }`}>
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Model */}
              <div>
                <label className="fm block text-[10px] text-[#5a5a5a] uppercase tracking-wider mb-1.5">
                  {isUr ? "ماڈل" : "Model"}
                </label>
                {info?.models.length ? (
                  <select value={aiModel || info.defaultModel} onChange={e => setAiModel(e.target.value)} className={INPUT}>
                    {info.models.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                ) : (
                  <input value={aiModel} onChange={e => setAiModel(e.target.value)}
                    placeholder={info?.defaultModel} className={INPUT} />
                )}
                <p className="fm text-[10px] text-[#3a3a3a] mt-1">// Default: {info?.defaultModel}</p>
              </div>

              {/* Base URL */}
              {(aiProvider === "LMSTUDIO" || aiProvider === "OLLAMA" || aiBaseUrl) && (
                <div>
                  <label className="fm block text-[10px] text-[#5a5a5a] uppercase tracking-wider mb-1.5">
                    {aiProvider === "LMSTUDIO" || aiProvider === "OLLAMA" ? "Local Server URL" : "API Base URL (optional)"}
                  </label>
                  <input value={aiBaseUrl} onChange={e => setAiBaseUrl(e.target.value)}
                    placeholder={info?.defaultUrl} dir="ltr" className={INPUT + " font-mono"} />
                </div>
              )}

              {/* API Key */}
              {info?.needsKey && (
                <div>
                  <label className="fm block text-[10px] text-[#5a5a5a] uppercase tracking-wider mb-1.5">
                    API Key *
                  </label>
                  <input type="password" value={apiKey} onChange={e => setApiKey(e.target.value)}
                    placeholder={info.placeholder} dir="ltr" className={INPUT} />
                  <a href={
                      aiProvider === "GEMINI"    ? "https://aistudio.google.com"
                    : aiProvider === "OPENAI"    ? "https://platform.openai.com/api-keys"
                    : "https://console.anthropic.com"
                  } target="_blank" rel="noreferrer" className="fm text-[10px] text-[#e8ff47] hover:underline mt-1 block">
                    ↗ {info.keyHint}
                  </a>
                </div>
              )}

              {/* Local AI info */}
              {!info?.needsKey && (
                <div className="border border-[#e8ff47]/20 bg-[#e8ff47]/5 p-3">
                  <p className="fm text-[10px] text-[#e8ff47] mb-1">
                    // {aiProvider === "LMSTUDIO" ? "LM Studio" : "Ollama"} Setup
                  </p>
                  <p className="text-xs text-[#5a5a5a]">
                    {aiProvider === "LMSTUDIO"
                      ? "1. lmstudio.ai se download karo → 2. Gemma ya Llama model download karo → 3. Local server start karo"
                      : "1. ollama.ai se install karo → 2. ollama pull gemma:2b → 3. Model name upar daalo"}
                  </p>
                </div>
              )}

              {appError && <p className="fm text-xs text-red-400">{appError}</p>}

              <div className="flex items-center gap-3 pt-1">
                <button onClick={saveApp} disabled={appSaving}
                  className="fd text-lg tracking-wide px-8 py-3 text-black disabled:opacity-50 transition hover:-translate-y-0.5"
                  style={{ background: "#e8ff47" }}>
                  {appSaving ? (isUr ? "محفوظ ہو رہا ہے..." : "SAVING...") : (isUr ? "محفوظ کریں" : "SAVE SETTINGS")}
                </button>
                {appSaved && <span className="fm text-xs text-[#e8ff47]">✓ {isUr ? "محفوظ ہو گیا" : "Saved — Rebuild Schema in Connected Apps"}</span>}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          SECTION 2 — Language + Text Size
      ════════════════════════════════════════════════════════════════════ */}
      <div className="border border-[#1e1e1e] bg-[#0d0d0d] p-5 space-y-5">
        <Section title={isUr ? "زبان اور متن کا سائز" : "Language & Display"} />

        {/* Language */}
        <div>
          <label className="fm block text-[10px] text-[#5a5a5a] uppercase tracking-wider mb-2">
            {isUr ? "زبان کی ترجیح" : "Preferred Language"}
          </label>
          <div className="flex gap-2">
            {[
              { val: "auto", labelEn: "Auto detect", labelUr: "خودکار" },
              { val: "ur",   labelEn: "اردو only",   labelUr: "صرف اردو" },
              { val: "en",   labelEn: "English only", labelUr: "صرف English" },
            ].map(opt => (
              <button key={opt.val} onClick={() => setPrefLang(opt.val)}
                className={`fm text-[10px] px-4 py-2.5 border transition-colors ${
                  prefLang === opt.val
                    ? "border-[#e8ff47] text-[#e8ff47] bg-[#e8ff47]/5"
                    : "border-[#1e1e1e] text-[#5a5a5a] hover:border-[#2a2a2a]"
                }`} dir="auto">
                {isUr ? opt.labelUr : opt.labelEn}
              </button>
            ))}
          </div>
          <p className="fm text-[10px] text-[#3a3a3a] mt-2">
            {isUr
              ? "// \"اردو\" منتخب کریں تو سب جوابات اردو میں ملیں گے"
              : "// \"Auto\" detects language from your question automatically"}
          </p>
        </div>

        {/* Text size */}
        <div>
          <label className="fm block text-[10px] text-[#5a5a5a] uppercase tracking-wider mb-2">
            {isUr ? "متن کا سائز" : "Text Size"}
          </label>
          <div className="flex gap-2 items-center">
            {[
              { val: "sm", label: "Small" },
              { val: "md", label: "Medium" },
              { val: "lg", label: "Large" },
            ].map(opt => (
              <button key={opt.val} onClick={() => setTextSize(opt.val)}
                className={`fm px-4 py-2 border transition-colors ${
                  textSize === opt.val
                    ? "border-[#e8ff47] text-[#e8ff47] bg-[#e8ff47]/5"
                    : "border-[#1e1e1e] text-[#5a5a5a] hover:border-[#2a2a2a]"
                }`}
                style={{ fontSize: opt.val === "sm" ? 10 : opt.val === "md" ? 12 : 14 }}>
                {opt.label}
              </button>
            ))}
            {/* Live preview */}
            <span className="text-[#5a5a5a] ml-2" style={{ fontSize: textSize === "sm" ? 11 : textSize === "md" ? 13 : 16 }}>
              {isUr ? "نمونہ متن" : "Sample text"}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3 pt-1">
          <button onClick={savePrefs} disabled={prefSaving}
            className="fd text-lg tracking-wide px-8 py-3 text-black disabled:opacity-50 transition hover:-translate-y-0.5"
            style={{ background: "#e8ff47" }}>
            {prefSaving ? "SAVING..." : (isUr ? "محفوظ کریں" : "SAVE PREFERENCES")}
          </button>
          {prefSaved && <span className="fm text-xs text-[#e8ff47]">✓ {isUr ? "محفوظ ہو گیا — صفحہ تازہ کریں" : "Saved — reload to apply"}</span>}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          SECTION 3 — Change Password
      ════════════════════════════════════════════════════════════════════ */}
      <div className="border border-[#1e1e1e] bg-[#0d0d0d] p-5 space-y-4">
        <Section title={isUr ? "پاس ورڈ تبدیل کریں" : "Change Password"} />

        <div>
          <label className="fm block text-[10px] text-[#5a5a5a] uppercase tracking-wider mb-1.5">
            {isUr ? "موجودہ پاس ورڈ" : "Current Password"}
          </label>
          <input type="password" value={currPw} onChange={e => setCurrPw(e.target.value)}
            placeholder="••••••••" className={INPUT} />
        </div>

        <div>
          <label className="fm block text-[10px] text-[#5a5a5a] uppercase tracking-wider mb-1.5">
            {isUr ? "نیا پاس ورڈ" : "New Password"}
          </label>
          <input type="password" value={newPw} onChange={e => setNewPw(e.target.value)}
            placeholder="••••••••" className={INPUT} />
        </div>

        <div>
          <label className="fm block text-[10px] text-[#5a5a5a] uppercase tracking-wider mb-1.5">
            {isUr ? "نیا پاس ورڈ دوبارہ" : "Confirm New Password"}
          </label>
          <input type="password" value={confirmPw} onChange={e => setConfirmPw(e.target.value)}
            placeholder="••••••••" className={INPUT}
            onKeyDown={e => e.key === "Enter" && !pwSaving && changePassword()} />
        </div>

        {pwMsg && (
          <p className={`fm text-xs ${pwMsg.ok ? "text-[#e8ff47]" : "text-red-400"}`}>{pwMsg.text}</p>
        )}

        <button onClick={changePassword} disabled={pwSaving || !currPw || !newPw || !confirmPw}
          className="fd text-lg tracking-wide px-8 py-3 text-black disabled:opacity-50 transition hover:-translate-y-0.5"
          style={{ background: "#e8ff47" }}>
          {pwSaving ? "UPDATING..." : (isUr ? "پاس ورڈ تبدیل کریں" : "CHANGE PASSWORD")}
        </button>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          SECTION 4 — Training Data Export
      ════════════════════════════════════════════════════════════════════ */}
      <div className="border border-[#1e1e1e] bg-[#0d0d0d] p-5 space-y-4">
        <Section title={isUr ? "AI ٹریننگ ڈیٹا" : "AI Training Data Export"} />

        <p className="text-sm text-[#5a5a5a]">
          {isUr
            ? "تمام کامیاب گفتگو JSONL فارمیٹ میں ڈاؤنلوڈ کریں — اپنا AI ماڈل تربیت کرنے کے لیے استعمال کریں۔"
            : "Download all successful chats as JSONL to fine-tune your own AI model."}
        </p>

        <div className="flex flex-wrap gap-3">
          <a href="/api/chat-history?format=jsonl"
            className="fd text-lg tracking-wide px-6 py-2.5 text-black transition hover:-translate-y-0.5 inline-block"
            style={{ background: "#e8ff47" }}
            download>
            {isUr ? "سب ڈاؤنلوڈ (JSONL)" : "ALL CHATS (JSONL)"}
          </a>
          <a href="/api/chat-history?format=jsonl&onlyGood=true"
            className="fd text-lg tracking-wide px-6 py-2.5 border border-[#e8ff47] text-[#e8ff47] transition hover:bg-[#e8ff47]/10 inline-block"
            download>
            {isUr ? "پسندیدہ جوابات (JSONL)" : "LIKED ONLY (JSONL)"}
          </a>
          <a href="/api/chat-history?format=json"
            className="fd text-base tracking-wide px-6 py-2.5 border border-[#1e1e1e] text-[#5a5a5a] transition hover:border-[#e8ff47] hover:text-[#e8ff47] inline-block">
            {isUr ? "JSON فارمیٹ" : "JSON FORMAT"}
          </a>
        </div>

        <p className="fm text-[10px] text-[#3a3a3a]">
          // Each row: {"{ prompt, completion, explanation, lang, feedback }"}
        </p>
      </div>

      {/* After saving tips */}
      <div className="border-t border-[#1e1e1e] pt-6">
        <p className="fm text-xs text-[#3a3a3a] uppercase tracking-wider mb-3">// {isUr ? "محفوظ کرنے کے بعد" : "After saving"}</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { num: "01", titleEn: "Rebuild Schema", titleUr: "اسکیما بنائیں",  descEn: "Connected Apps → Rebuild Schema", descUr: "Connected Apps → Rebuild Schema", href: "/dashboard/widget-sites" },
            { num: "02", titleEn: "Test Chat",       titleUr: "چیٹ آزمائیں",    descEn: "AI Chat → ask a question",        descUr: "AI Chat → سوال پوچھیں",           href: "/dashboard" },
            { num: "03", titleEn: "Embed Widget",    titleUr: "ویجٹ لگائیں",   descEn: "Copy script tag to your ERP",     descUr: "Script tag کاپی کریں",            href: "/dashboard/widget-sites" },
          ].map(s => (
            <a key={s.num} href={s.href}
              className="border border-[#1e1e1e] p-4 hover:border-[#e8ff47] transition-colors group">
              <div className="fd text-3xl text-[#1e1e1e] group-hover:text-[#e8ff47] transition-colors mb-2">{s.num}</div>
              <p className="text-sm font-medium text-white mb-1">{isUr ? s.titleUr : s.titleEn}</p>
              <p className="fm text-[10px] text-[#5a5a5a]">{isUr ? s.descUr : s.descEn}</p>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}