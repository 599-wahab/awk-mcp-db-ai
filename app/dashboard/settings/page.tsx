// app/dashboard/settings/page.tsx
"use client";
import { useState, useEffect } from "react";

interface App {
  id: string;
  name: string;
  apiKey: string;
  geminiKey?: string;
  dbType: string;
  aiProvider: string;
  aiModel?: string;
  aiBaseUrl?: string;
}

const AI_PROVIDERS = [
  {  
    value: "GEMINI", 
    label: "Google Gemini", 
    needsKey: true, 
    defaultModel: "gemini-3-flash-preview",
    defaultUrl: "https://generativelanguage.googleapis.com/v1beta",
    models: [
      "gemini-3-flash-preview",
      "gemini-2.0-flash-exp",
      "gemini-1.0-pro"
    ]
  },
  { value: "OPENAI", label: "OpenAI (ChatGPT)", needsKey: true, defaultModel: "gpt-3.5-turbo", defaultUrl: "https://api.openai.com/v1" },
  { value: "ANTHROPIC", label: "Anthropic Claude", needsKey: true, defaultModel: "claude-3-haiku-20240307", defaultUrl: "https://api.anthropic.com" },
  { value: "LMSTUDIO", label: "LM Studio (Local)", needsKey: false, defaultModel: "local-model", defaultUrl: "http://localhost:1234/v1" },
  { value: "OLLAMA", label: "Ollama (Local)", needsKey: false, defaultModel: "llama2", defaultUrl: "http://localhost:11434" },
];

export default function SettingsPage() {
  const [apps, setApps] = useState<App[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [dbUrl, setDbUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [aiProvider, setAiProvider] = useState("GEMINI");
  const [aiModel, setAiModel] = useState("");
  const [aiBaseUrl, setAiBaseUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/widget/register")
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data) && data.length > 0) {
          setApps(data);
          setSelectedId(data[0].id);
          setApiKey(data[0].geminiKey || "");
          setAiProvider(data[0].aiProvider || "GEMINI");
          setAiModel(data[0].aiModel || "");
          setAiBaseUrl(data[0].aiBaseUrl || "");
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    fetch(`/api/settings?appId=${selectedId}`)
      .then(r => r.json())
      .then(data => {
        setDbUrl(data.dbUrl || "");
        setApiKey(data.apiKey || "");
        setAiProvider(data.aiProvider || "GEMINI");
        setAiModel(data.aiModel || "");
        setAiBaseUrl(data.aiBaseUrl || "");
      })
      .catch(() => {});
  }, [selectedId]);

  const selectedProvider = AI_PROVIDERS.find(p => p.value === aiProvider);
  
  // Auto-fill defaults when provider changes
  useEffect(() => {
    if (selectedProvider) {
      if (!aiModel) setAiModel(selectedProvider.defaultModel);
      if (!aiBaseUrl) setAiBaseUrl(selectedProvider.defaultUrl);
    }
  }, [aiProvider, selectedProvider]);

  async function handleSave() {
    if (!selectedId) { setError("Please select an app first."); return; }
    setSaving(true);
    setError("");
    const res = await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        appId: selectedId, 
        dbUrl, 
        apiKey,
        aiProvider,
        aiModel,
        aiBaseUrl,
      }),
    });
    const data = await res.json();
    if (data.success) { setSaved(true); setTimeout(() => setSaved(false), 3000); }
    else setError(data.error || "Save failed");
    setSaving(false);
  }

  const selectedApp = apps.find(a => a.id === selectedId);

  return (
    <div className="max-w-2xl space-y-8 pb-12" style={{ fontFamily: "'DM Sans',sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Space+Mono:wght@400;700&family=DM+Sans:wght@300;400;500;600&display=swap');
        .fd{font-family:'Bebas Neue',sans-serif;} .fm{font-family:'Space Mono',monospace;}
      `}</style>

      <div>
        <div className="fm text-xs text-[#e8ff47] uppercase tracking-widest mb-2">// Settings</div>
        <h1 className="fd text-4xl tracking-wide text-white">APP SETTINGS</h1>
        <p className="text-[#5a5a5a] text-sm mt-1">Configure your database connection and AI provider for each connected app.</p>
      </div>

      <div className="border border-[#e8ff47]/20 bg-[#e8ff47]/5 p-4 rounded-none">
        <p className="fm text-xs text-[#e8ff47] uppercase tracking-wider mb-2">// Supported AI Providers</p>
        <div className="grid grid-cols-2 gap-2 text-sm text-[#5a5a5a]">
          <div>✓ Google Gemini (Free tier available)</div>
          <div>✓ OpenAI ChatGPT (GPT-3.5/4)</div>
          <div>✓ Anthropic Claude</div>
          <div>✓ LM Studio (Local - Free)</div>
          <div>✓ Ollama (Local - Free)</div>
        </div>
      </div>

      {apps.length === 0 ? (
        <div className="border border-[#1e1e1e] p-8 text-center">
          <p className="fd text-2xl text-[#5a5a5a] mb-2">NO APPS YET</p>
          <p className="text-sm text-[#5a5a5a]">Go to <a href="/dashboard/widget-sites" className="text-[#e8ff47] hover:underline">Connected Apps</a> and register your first app.</p>
        </div>
      ) : (
        <div className="space-y-6">
          <div>
            <label className="fm block text-[10px] text-[#5a5a5a] uppercase tracking-wider mb-2">Select App</label>
            <select
              value={selectedId}
              onChange={e => setSelectedId(e.target.value)}
              className="w-full bg-black border border-[#1e1e1e] text-white px-4 py-3 text-sm focus:outline-none focus:border-[#e8ff47] transition-colors"
            >
              {apps.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>

          {selectedApp && (
            <div className="border border-[#1e1e1e] p-1">
              <div className="flex items-center justify-between px-4 py-3 border-b border-[#1e1e1e]">
                <p className="fd text-lg tracking-wide text-white">{selectedApp.name}</p>
                <span className="fm text-[10px] text-[#5a5a5a] bg-[#1e1e1e] px-2 py-1">{selectedApp.dbType}</span>
              </div>
              <div className="p-4 space-y-4">
                {/* API Key (read only) */}
                <div>
                  <label className="fm block text-[10px] text-[#5a5a5a] uppercase tracking-wider mb-1.5">Widget API Key (read only)</label>
                  <div className="flex gap-2">
                    <code className="flex-1 bg-black border border-[#1e1e1e] text-[#e8ff47] px-4 py-2.5 text-xs truncate">{selectedApp.apiKey}</code>
                    <button
                      onClick={() => navigator.clipboard.writeText(selectedApp.apiKey)}
                      className="fm text-xs border border-[#1e1e1e] text-[#5a5a5a] px-3 hover:border-[#e8ff47] hover:text-[#e8ff47] transition-colors"
                    >
                      Copy
                    </button>
                  </div>
                </div>

                {/* Database URL */}
                <div>
                  <label className="fm block text-[10px] text-[#5a5a5a] uppercase tracking-wider mb-1.5">Database URL *</label>
                  <textarea
                    value={dbUrl}
                    onChange={e => setDbUrl(e.target.value)}
                    rows={3}
                    placeholder="postgresql://user:password@ep-xxx.neon.tech/dbname?sslmode=require"
                    className="w-full bg-black border border-[#1e1e1e] text-white px-4 py-3 text-sm focus:outline-none focus:border-[#e8ff47] transition-colors resize-none font-mono"
                  />
                </div>

                {/* AI Provider Selection */}
                <div>
                  <label className="fm block text-[10px] text-[#5a5a5a] uppercase tracking-wider mb-1.5">AI Provider *</label>
                  <select
                    value={aiProvider}
                    onChange={e => setAiProvider(e.target.value)}
                    className="w-full bg-black border border-[#1e1e1e] text-white px-4 py-3 text-sm focus:outline-none focus:border-[#e8ff47] transition-colors"
                  >
                    {AI_PROVIDERS.map(p => (
                      <option key={p.value} value={p.value}>{p.label}</option>
                    ))}
                  </select>
                </div>

                {/* AI Model (optional - override default) */}
                <div>
                  <label className="fm block text-[10px] text-[#5a5a5a] uppercase tracking-wider mb-1.5">AI Model (optional)</label>
                  <input
                    value={aiModel}
                    onChange={e => setAiModel(e.target.value)}
                    placeholder={selectedProvider?.defaultModel}
                    className="w-full bg-black border border-[#1e1e1e] text-white px-4 py-3 text-sm focus:outline-none focus:border-[#e8ff47] transition-colors"
                  />
                  <p className="fm text-[10px] text-[#3a3a3a] mt-1">Leave empty to use default: {selectedProvider?.defaultModel}</p>
                </div>

                {/* AI Base URL (for local/LM Studio/Ollama) */}
                <div>
                  <label className="fm block text-[10px] text-[#5a5a5a] uppercase tracking-wider mb-1.5">API Base URL (optional)</label>
                  <input
                    value={aiBaseUrl}
                    onChange={e => setAiBaseUrl(e.target.value)}
                    placeholder={selectedProvider?.defaultUrl}
                    className="w-full bg-black border border-[#1e1e1e] text-white px-4 py-3 text-sm focus:outline-none focus:border-[#e8ff47] transition-colors"
                  />
                  <p className="fm text-[10px] text-[#3a3a3a] mt-1">
                    For LM Studio: http://localhost:1234/v1 | Ollama: http://localhost:11434
                  </p>
                </div>

                {/* API Key (only for providers that need it) */}
                {selectedProvider?.needsKey && (
                  <div>
                    <label className="fm block text-[10px] text-[#5a5a5a] uppercase tracking-wider mb-1.5">API Key *</label>
                    <input
                      type="password"
                      value={apiKey}
                      onChange={e => setApiKey(e.target.value)}
                      placeholder={aiProvider === "GEMINI" ? "AIzaSy..." : "sk-..."}
                      className="w-full bg-black border border-[#1e1e1e] text-white px-4 py-3 text-sm focus:outline-none focus:border-[#e8ff47] transition-colors"
                    />
                    <p className="fm text-[10px] text-[#3a3a3a] mt-1">
                      {aiProvider === "GEMINI" && "Get free key from aistudio.google.com"}
                      {aiProvider === "OPENAI" && "Get key from platform.openai.com"}
                      {aiProvider === "ANTHROPIC" && "Get key from console.anthropic.com"}
                    </p>
                  </div>
                )}

                {error && (
                  <div className="border border-red-500/30 bg-red-500/10 px-4 py-2">
                    <p className="fm text-xs text-red-400">{error}</p>
                  </div>
                )}

                <div className="flex items-center gap-4 pt-2">
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="fd text-lg tracking-wide px-8 py-3 text-black disabled:opacity-50 transition hover:-translate-y-0.5"
                    style={{ background: "#e8ff47" }}
                  >
                    {saving ? "SAVING..." : "SAVE SETTINGS"}
                  </button>
                  {saved && <span className="fm text-xs text-[#e8ff47]">✓ Saved successfully</span>}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Local Setup Instructions */}
      <div className="border-t border-[#1e1e1e] pt-6">
        <p className="fm text-xs text-[#3a3a3a] uppercase tracking-wider mb-3">// Local AI Setup (LM Studio / Ollama)</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="border border-[#1e1e1e] p-4">
            <p className="fd text-lg text-[#e8ff47] mb-2">LM Studio</p>
            <ol className="space-y-2 text-sm text-[#5a5a5a] list-decimal list-inside">
              <li>Download LM Studio from lmstudio.ai</li>
              <li>Download a model (e.g., Gemma, Llama, Phi)</li>
              <li>Start the local inference server</li>
              <li>Set Base URL to http://localhost:1234/v1</li>
              <li>Set Model to your downloaded model name</li>
            </ol>
          </div>
          <div className="border border-[#1e1e1e] p-4">
            <p className="fd text-lg text-[#e8ff47] mb-2">Ollama</p>
            <ol className="space-y-2 text-sm text-[#5a5a5a] list-decimal list-inside">
              <li>Install Ollama from ollama.ai</li>
              <li>Run: ollama pull llama2 (or gemma:2b)</li>
              <li>Ollama runs on http://localhost:11434</li>
              <li>Set Model to your downloaded model name</li>
              <li>No API key required</li>
            </ol>
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