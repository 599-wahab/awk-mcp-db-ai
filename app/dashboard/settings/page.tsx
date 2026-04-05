"use client";
// app/settings/page.tsx
// AWK TLD BOT — Settings page (black/lime theme)

import { useState, useEffect } from "react";

interface App {
  id: string;
  name: string;
  apiKey: string;
  geminiKey?: string;
  dbType: string;
}

export default function SettingsPage() {
  const [apps, setApps] = useState<App[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [dbUrl, setDbUrl] = useState("");
  const [geminiKey, setGeminiKey] = useState("");
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
          setGeminiKey(data[0].geminiKey || "");
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
        setGeminiKey(data.geminiKey || "");
      })
      .catch(() => {});
  }, [selectedId]);

  async function handleSave() {
    if (!selectedId) { setError("Please select an app first."); return; }
    setSaving(true);
    setError("");
    const res = await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ appId: selectedId, dbUrl, geminiKey }),
    });
    const data = await res.json();
    if (data.success) { setSaved(true); setTimeout(() => setSaved(false), 3000); }
    else setError(data.error || "Save failed");
    setSaving(false);
  }

  const selectedApp = apps.find(a => a.id === selectedId);

  return (
    <div className="max-w-2xl space-y-8" style={{ fontFamily: "'DM Sans',sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Space+Mono:wght@400;700&family=DM+Sans:wght@300;400;500;600&display=swap');.fd{font-family:'Bebas Neue',sans-serif;}.fm{font-family:'Space Mono',monospace;}`}</style>

      {/* Header */}
      <div>
        <div className="fm text-xs text-[#e8ff47] uppercase tracking-widest mb-2">// Settings</div>
        <h1 className="fd text-4xl tracking-wide text-white">APP SETTINGS</h1>
        <p className="text-[#5a5a5a] text-sm mt-1">Configure your database connection and AI key for each connected app.</p>
      </div>

      {/* How it works note */}
      <div className="border border-[#e8ff47]/20 bg-[#e8ff47]/5 p-4 rounded-none">
        <p className="fm text-xs text-[#e8ff47] uppercase tracking-wider mb-2">// How it works</p>
        <ul className="space-y-1 text-sm text-[#5a5a5a]">
          <li>1. Select the app you want to configure below</li>
          <li>2. Paste your <span className="text-white font-medium">Database URL</span> (NeonDB, Supabase, Railway, etc.)</li>
          <li>3. Paste your <span className="text-white font-medium">Gemini API Key</span> from <span className="text-[#e8ff47]">aistudio.google.com</span></li>
          <li>4. Save — then go to <span className="text-white font-medium">Connected Apps</span> and click <span className="text-[#e8ff47]">Rebuild Schema</span></li>
          <li>5. Come back to <span className="text-white font-medium">AI Chat</span> and start asking questions!</li>
        </ul>
      </div>

      {apps.length === 0 ? (
        <div className="border border-[#1e1e1e] p-8 text-center">
          <p className="fd text-2xl text-[#5a5a5a] mb-2">NO APPS YET</p>
          <p className="text-sm text-[#5a5a5a]">Go to <a href="/dashboard/widget-sites" className="text-[#e8ff47] hover:underline">Connected Apps</a> and register your first app.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* App selector */}
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
                  <p className="fm text-[10px] text-[#3a3a3a] mt-1">// Use this key in your ERP's embed script</p>
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
                    dir="ltr"
                  />
                  <p className="fm text-[10px] text-[#3a3a3a] mt-1">// NeonDB, Supabase, Railway, or any PostgreSQL connection string</p>
                </div>

                {/* Gemini Key */}
                <div>
                  <label className="fm block text-[10px] text-[#5a5a5a] uppercase tracking-wider mb-1.5">Gemini API Key *</label>
                  <input
                    type="password"
                    value={geminiKey}
                    onChange={e => setGeminiKey(e.target.value)}
                    placeholder="AIzaSy..."
                    className="w-full bg-black border border-[#1e1e1e] text-white px-4 py-3 text-sm focus:outline-none focus:border-[#e8ff47] transition-colors"
                    dir="ltr"
                  />
                  <p className="fm text-[10px] text-[#3a3a3a] mt-1">
                    // Get free key from{" "}
                    <a href="https://aistudio.google.com" target="_blank" rel="noreferrer" className="text-[#e8ff47] hover:underline">aistudio.google.com</a>
                  </p>
                </div>

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

      {/* Next steps */}
      <div className="border-t border-[#1e1e1e] pt-6">
        <p className="fm text-xs text-[#3a3a3a] uppercase tracking-wider mb-3">// After saving</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {[
            { num: "01", title: "Rebuild Schema", desc: "Go to Connected Apps → Rebuild Schema", href: "/dashboard/widget-sites" },
            { num: "02", title: "Test Chat", desc: "Go to AI Chat and ask a question", href: "/dashboard" },
            { num: "03", title: "Embed Widget", desc: "Copy the script tag and paste in your ERP", href: "/dashboard/widget-sites" },
          ].map(s => (
            <a key={s.num} href={s.href} className="border border-[#1e1e1e] p-4 hover:border-[#e8ff47] transition-colors group">
              <div className="fd text-3xl text-[#1e1e1e] group-hover:text-[#e8ff47] transition-colors mb-2">{s.num}</div>
              <p className="text-sm font-medium text-white mb-1">{s.title}</p>
              <p className="fm text-[10px] text-[#5a5a5a]">{s.desc}</p>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}