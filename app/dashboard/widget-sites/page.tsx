"use client";
// app/dashboard/widget-sites/page.tsx — AWK TLD BOT theme
//bot code
import { useState, useEffect } from "react";

interface App {
  id: string;
  name: string;
  apiKey: string;
  origin: string | null;
  isActive: boolean;
  totalChats: number;
  lastActiveAt: string | null;
  createdAt: string;
  schemaBuiltAt: string | null;
  dbType: string;
  geminiKey?: string;
  contextJson?: string | null;
}

const BASE_URL = "https://awk-tld-bot.vercel.app";

function parseContext(raw?: string | null) {
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export default function WidgetSitesPage() {
  const [apps, setApps] = useState<App[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    name: "",
    origin: "",
    dbUrl: "",
    dbType: "POSTGRESQL",
    geminiKey: "",
    widgetMode: "erp-dashboard",
    scopeMode: "auto",
    tenantColumn: "tenant_id",
    userColumn: "user_id",
  });
  const [showForm, setShowForm] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [rebuildingId, setRebuildingId] = useState<string | null>(null);
  const [newApp, setNewApp] = useState<{ apiKey: string; snippet: string; name: string } | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLoading, setEditLoading] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState("");
  const [editSaved, setEditSaved] = useState(false);
  const [editOriginalDbUrl, setEditOriginalDbUrl] = useState("");
  const [editForm, setEditForm] = useState({
    name: "",
    dbUrl: "",
    origin: "",
    dbType: "POSTGRESQL",
  });

  useEffect(() => { fetchApps(); }, []);

  async function fetchApps() {
    setLoading(true);
    const res = await fetch("/api/widget/register");
    const data = await res.json();
    setApps(Array.isArray(data) ? data : []);
    setLoading(false);
  }

  async function createApp() {
    if (!form.name || !form.dbUrl) return;
    setCreating(true);
    const contextJson = {
      widgetMode: form.widgetMode,
      dataScope: {
        mode: form.scopeMode,
        tenantColumn: form.tenantColumn || undefined,
        userColumn: form.userColumn || undefined,
      },
    };
    const res = await fetch("/api/widget/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        origin: form.origin,
        dbUrl: form.dbUrl,
        dbType: form.dbType,
        geminiKey: form.geminiKey,
        contextJson,
      }),
    });
    const data = await res.json();
    setNewApp({ apiKey: data.apiKey, snippet: data.snippet, name: data.name });
    setShowForm(false);
    setForm({
      name: "",
      origin: "",
      dbUrl: "",
      dbType: "POSTGRESQL",
      geminiKey: "",
      widgetMode: "erp-dashboard",
      scopeMode: "auto",
      tenantColumn: "tenant_id",
      userColumn: "user_id",
    });
    setCreating(false);
    fetchApps();
  }

  async function deleteApp(id: string) {
    if (!confirm("Delete this app? All chat history will be lost.")) return;
    await fetch("/api/widget/register", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    fetchApps();
  }

  async function rebuildSchema(appId: string) {
    setRebuildingId(appId);
    const res = await fetch("/api/schema", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ appId }) });
    const data = await res.json();
    setRebuildingId(null);
    if (data.success) { alert(`✅ Schema rebuilt! Found ${data.tables} tables.`); fetchApps(); }
    else {
      const detail = [
        `❌ ${data.error || "Schema rebuild failed."}`,
        data.advice ? `\n${data.advice}` : "",
        data.code ? `\nCode: ${data.code}` : "",
      ].filter(Boolean).join("\n");
      alert(detail);
    }
  }

  async function openDataEditor(app: App) {
    const nextId = editingId === app.id ? null : app.id;
    setEditingId(nextId);
    setEditError("");
    setEditSaved(false);

    if (!nextId) return;

    setEditForm({
      name: app.name,
      dbUrl: "",
      origin: app.origin || "",
      dbType: app.dbType || "POSTGRESQL",
    });
    setEditOriginalDbUrl("");
    setEditLoading(true);

    try {
      const res = await fetch(`/api/settings?appId=${app.id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not load app data.");

      const dbUrl = data.dbUrl || "";
      setEditOriginalDbUrl(dbUrl);
      setEditForm({
        name: data.name || app.name,
        dbUrl,
        origin: data.origin || "",
        dbType: data.dbType || app.dbType || "POSTGRESQL",
      });
    } catch (error) {
      setEditError(
        error instanceof Error ? error.message : "Could not load app data.",
      );
    } finally {
      setEditLoading(false);
    }
  }

  async function saveDataEditor() {
    if (!editingId) return;
    if (!editForm.name.trim()) {
      setEditError("App name is required.");
      return;
    }
    if (!editForm.dbUrl.trim()) {
      setEditError("Database URL is required.");
      return;
    }

    setEditSaving(true);
    setEditError("");
    setEditSaved(false);

    const payload: Record<string, string> = {
      id: editingId,
      name: editForm.name.trim(),
      origin: editForm.origin.trim(),
      dbType: editForm.dbType,
    };

    if (editForm.dbUrl.trim() !== editOriginalDbUrl) {
      payload.dbUrl = editForm.dbUrl.trim();
    }

    try {
      const res = await fetch("/api/widget/register", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Save failed.");

      setEditSaved(true);
      setEditOriginalDbUrl(editForm.dbUrl.trim());
      await fetchApps();
    } catch (error) {
      setEditError(error instanceof Error ? error.message : "Save failed.");
    } finally {
      setEditSaving(false);
    }
  }

  function copy(text: string, key: string) {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  }

  return (
    <div className="max-w-3xl space-y-8" style={{ fontFamily: "'DM Sans',sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Space+Mono:wght@400;700&family=DM+Sans:wght@300;400;500;600&display=swap');.fd{font-family:'Bebas Neue',sans-serif;}.fm{font-family:'Space Mono',monospace;}`}</style>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="fm text-xs text-[#e8ff47] uppercase tracking-widest mb-2">// Connected Apps</div>
          <h1 className="fd text-4xl tracking-wide text-white">YOUR APPS</h1>
          <p className="text-[#5a5a5a] text-sm mt-1">Register your ERPs and apps to embed the AI chat widget.</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="fd text-lg tracking-wide px-6 py-2.5 text-black transition hover:-translate-y-0.5"
          style={{ background: "#e8ff47" }}
        >
          + NEW APP
        </button>
      </div>

      {/* How it works */}
      <div className="border border-[#e8ff47]/20 bg-[#e8ff47]/5 p-4">
        <p className="fm text-xs text-[#e8ff47] uppercase tracking-wider mb-2">// How to connect your ERP</p>
        <ol className="space-y-1 text-sm text-[#5a5a5a] list-none">
          <li><span className="text-[#e8ff47] mr-2">01</span>Click <strong className="text-white">+ New App</strong> and fill in your app name, database URL, and Gemini key</li>
          <li><span className="text-[#e8ff47] mr-2">02</span>Click <strong className="text-white">Create</strong> — copy the <strong className="text-white">API Key</strong> and <strong className="text-white">Embed Snippet</strong></li>
          <li><span className="text-[#e8ff47] mr-2">03</span>Paste the snippet before <code className="text-[#e8ff47]">&lt;/body&gt;</code> in your ERP's HTML</li>
          <li><span className="text-[#e8ff47] mr-2">04</span>Click <strong className="text-white">Rebuild Schema</strong> so the AI learns your database structure</li>
          <li><span className="text-[#e8ff47] mr-2">05</span>A chat button appears in your ERP — users can now ask questions in Urdu or English!</li>
        </ol>
      </div>

      {/* New app success */}
      {newApp && (
        <div className="border border-[#e8ff47]/40 bg-[#e8ff47]/5 p-5">
          <p className="fd text-xl text-[#e8ff47] mb-4">✓ {newApp.name} REGISTERED</p>
          <div className="space-y-3">
            <div>
              <p className="fm text-[10px] text-[#5a5a5a] uppercase tracking-wider mb-1.5">API Key — for embed.js script:</p>
              <div className="flex gap-2">
                <code className="flex-1 bg-black border border-[#1e1e1e] text-[#e8ff47] px-3 py-2 text-xs break-all">{newApp.apiKey}</code>
                <button onClick={() => copy(newApp.apiKey, "nkey")} className="fm text-xs border border-[#1e1e1e] text-white px-3 hover:border-[#e8ff47] hover:text-[#e8ff47] transition-colors whitespace-nowrap">
                  {copied === "nkey" ? "✓" : "Copy"}
                </button>
              </div>
            </div>
            <div>
              <p className="fm text-[10px] text-[#5a5a5a] uppercase tracking-wider mb-1.5">Embed Snippet — paste before &lt;/body&gt;:</p>
              <div className="flex gap-2 items-start">
                <code className="flex-1 bg-black border border-[#1e1e1e] text-[#e8ff47] px-3 py-2 text-xs break-all">{newApp.snippet}</code>
                <button onClick={() => copy(newApp.snippet, "nsnip")} className="fm text-xs border border-[#1e1e1e] text-white px-3 py-2 hover:border-[#e8ff47] hover:text-[#e8ff47] transition-colors whitespace-nowrap">
                  {copied === "nsnip" ? "✓" : "Copy"}
                </button>
              </div>
            </div>
          </div>
          <button onClick={() => setNewApp(null)} className="fm text-xs text-[#3a3a3a] hover:text-[#5a5a5a] mt-3 transition-colors">Dismiss</button>
        </div>
      )}

      {/* Create form */}
      {showForm && (
        <div className="border border-[#1e1e1e] bg-[#0d0d0d]">
          <div className="px-5 py-4 border-b border-[#1e1e1e]">
            <p className="fd text-xl tracking-wide text-white">REGISTER NEW APP</p>
          </div>
          <div className="p-5 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="fm block text-[10px] text-[#5a5a5a] uppercase tracking-wider mb-1.5">App Name *</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. AWK TLD ERP"
                  className="w-full bg-black border border-[#1e1e1e] text-white px-4 py-2.5 text-sm focus:outline-none focus:border-[#e8ff47] transition-colors" />
              </div>
              <div className="col-span-2">
                <label className="fm block text-[10px] text-[#5a5a5a] uppercase tracking-wider mb-1.5">Database URL *</label>
                <input value={form.dbUrl} onChange={e => setForm(f => ({ ...f, dbUrl: e.target.value }))}
                  placeholder="postgresql://user:pass@host/dbname?sslmode=require"
                  className="w-full bg-black border border-[#1e1e1e] text-white px-4 py-2.5 text-sm focus:outline-none focus:border-[#e8ff47] transition-colors font-mono"
                  dir="ltr" />
                <p className="fm text-[10px] text-[#3a3a3a] mt-1">// NeonDB / Supabase / Railway connection string</p>
              </div>
              <div className="col-span-2">
                <label className="fm block text-[10px] text-[#5a5a5a] uppercase tracking-wider mb-1.5">Gemini API Key</label>
                <input type="password" value={form.geminiKey} onChange={e => setForm(f => ({ ...f, geminiKey: e.target.value }))}
                  placeholder="AIzaSy... (get free from aistudio.google.com)"
                  className="w-full bg-black border border-[#1e1e1e] text-white px-4 py-2.5 text-sm focus:outline-none focus:border-[#e8ff47] transition-colors" dir="ltr" />
              </div>
              <div>
                <label className="fm block text-[10px] text-[#5a5a5a] uppercase tracking-wider mb-1.5">DB Type</label>
                <select value={form.dbType} onChange={e => setForm(f => ({ ...f, dbType: e.target.value }))}
                  className="w-full bg-black border border-[#1e1e1e] text-white px-4 py-2.5 text-sm focus:outline-none focus:border-[#e8ff47]">
                  <option value="POSTGRESQL">PostgreSQL</option>
                  <option value="MYSQL">MySQL</option>
                </select>
              </div>
              <div>
                <label className="fm block text-[10px] text-[#5a5a5a] uppercase tracking-wider mb-1.5">Origin (optional)</label>
                <input value={form.origin} onChange={e => setForm(f => ({ ...f, origin: e.target.value }))}
                  placeholder="https://myerp.vercel.app"
                  className="w-full bg-black border border-[#1e1e1e] text-white px-4 py-2.5 text-sm focus:outline-none focus:border-[#e8ff47] transition-colors" />
              </div>
              <div>
                <label className="fm block text-[10px] text-[#5a5a5a] uppercase tracking-wider mb-1.5">Widget Mode</label>
                <select value={form.widgetMode} onChange={e => setForm(f => ({ ...f, widgetMode: e.target.value }))}
                  className="w-full bg-black border border-[#1e1e1e] text-white px-4 py-2.5 text-sm focus:outline-none focus:border-[#e8ff47]">
                  <option value="erp-dashboard">ERP dashboard safe mode</option>
                  <option value="erp">ERP safe mode</option>
                  <option value="general">General chat mode</option>
                </select>
              </div>
              <div>
                <label className="fm block text-[10px] text-[#5a5a5a] uppercase tracking-wider mb-1.5">Data Scope</label>
                <select value={form.scopeMode} onChange={e => setForm(f => ({ ...f, scopeMode: e.target.value }))}
                  className="w-full bg-black border border-[#1e1e1e] text-white px-4 py-2.5 text-sm focus:outline-none focus:border-[#e8ff47]">
                  <option value="auto">Auto detect</option>
                  <option value="database">One database per customer</option>
                  <option value="tenant">Filter by tenant column</option>
                  <option value="user">Filter by user column</option>
                  <option value="hybrid">Filter by tenant and user</option>
                </select>
              </div>
              <div>
                <label className="fm block text-[10px] text-[#5a5a5a] uppercase tracking-wider mb-1.5">Tenant Column</label>
                <input value={form.tenantColumn} onChange={e => setForm(f => ({ ...f, tenantColumn: e.target.value }))}
                  placeholder="tenant_id"
                  className="w-full bg-black border border-[#1e1e1e] text-white px-4 py-2.5 text-sm focus:outline-none focus:border-[#e8ff47] transition-colors font-mono" />
              </div>
              <div>
                <label className="fm block text-[10px] text-[#5a5a5a] uppercase tracking-wider mb-1.5">User Column</label>
                <input value={form.userColumn} onChange={e => setForm(f => ({ ...f, userColumn: e.target.value }))}
                  placeholder="user_id"
                  className="w-full bg-black border border-[#1e1e1e] text-white px-4 py-2.5 text-sm focus:outline-none focus:border-[#e8ff47] transition-colors font-mono" />
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={createApp} disabled={creating || !form.name || !form.dbUrl}
                className="fd text-lg tracking-wide px-8 py-2.5 text-black disabled:opacity-50 transition hover:-translate-y-0.5"
                style={{ background: "#e8ff47" }}>
                {creating ? "CREATING..." : "CREATE APP"}
              </button>
              <button onClick={() => setShowForm(false)} className="fm text-xs border border-[#1e1e1e] text-[#5a5a5a] px-6 hover:border-[#e8ff47] hover:text-white transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Apps list */}
      {loading ? (
        <div className="text-center py-12 fm text-xs text-[#3a3a3a]">// Loading...</div>
      ) : apps.length === 0 ? (
        <div className="border border-dashed border-[#1e1e1e] py-16 text-center">
          <p className="fd text-3xl text-[#1e1e1e] mb-2">NO APPS YET</p>
          <p className="fm text-xs text-[#3a3a3a]">// Click + New App to register your first ERP</p>
        </div>
      ) : (
        <div className="space-y-3">
          {apps.map(app => {
            const context = parseContext(app.contextJson);
            const widgetMode = context?.widgetMode || "general";
            const scopeMode = context?.dataScope?.mode || "auto";
            return (
            <div key={app.id} className="border border-[#1e1e1e] bg-[#0d0d0d] hover:border-[#2a2a2a] transition-colors">
              <div className="flex items-start justify-between gap-4 p-5">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="fd text-xl tracking-wide text-white">{app.name}</h3>
                    <span className={`fm text-[9px] px-2 py-0.5 ${app.isActive ? "bg-[#e8ff47]/10 text-[#e8ff47]" : "bg-[#1e1e1e] text-[#5a5a5a]"}`}>
                      {app.isActive ? "ACTIVE" : "INACTIVE"}
                    </span>
                    <span className="fm text-[9px] bg-[#1e1e1e] text-[#5a5a5a] px-2 py-0.5">{app.dbType}</span>
                    <span className="fm text-[9px] bg-[#1e1e1e] text-[#5a5a5a] px-2 py-0.5">{widgetMode.toUpperCase()}</span>
                    <span className="fm text-[9px] bg-[#1e1e1e] text-[#5a5a5a] px-2 py-0.5">SCOPE {scopeMode.toUpperCase()}</span>
                    {app.geminiKey && <span className="fm text-[9px] bg-[#e8ff47]/10 text-[#e8ff47] px-2 py-0.5">GEMINI ✓</span>}
                  </div>
                  <p className="fm text-[10px] text-[#3a3a3a] truncate mb-1">{app.apiKey}</p>
                  {app.origin && <p className="fm text-[10px] text-[#3a3a3a]">{app.origin}</p>}
                  <div className="flex gap-4 mt-2 fm text-[10px] text-[#3a3a3a]">
                    <span>💬 {app.totalChats} chats</span>
                    {app.schemaBuiltAt ? <span className="text-[#e8ff47]/60">🗄️ Schema: {new Date(app.schemaBuiltAt).toLocaleDateString()}</span> : <span className="text-red-400/60">⚠️ No schema — click Rebuild</span>}
                    {app.lastActiveAt && <span>⏱ {new Date(app.lastActiveAt).toLocaleDateString()}</span>}
                  </div>
                </div>
                <div className="flex flex-col gap-2 shrink-0">
                  <button onClick={() => copy(app.apiKey, app.id + "k")}
                    className="fm text-[10px] border border-[#1e1e1e] text-[#5a5a5a] px-3 py-1.5 hover:border-[#e8ff47] hover:text-[#e8ff47] transition-colors">
                    {copied === app.id + "k" ? "✓ Copied" : "Copy Key"}
                  </button>
                  <button onClick={() => openDataEditor(app)}
                    className={`fm text-[10px] border px-3 py-1.5 transition-colors ${editingId === app.id ? "border-[#e8ff47] text-[#e8ff47]" : "border-[#1e1e1e] text-[#5a5a5a] hover:border-[#e8ff47] hover:text-[#e8ff47]"}`}>
                    {editingId === app.id ? "Close Data" : "Data"}
                  </button>
                  <button onClick={() => rebuildSchema(app.id)} disabled={rebuildingId === app.id}
                    className="fm text-[10px] border border-[#1e1e1e] text-[#5a5a5a] px-3 py-1.5 hover:border-[#e8ff47] hover:text-[#e8ff47] transition-colors disabled:opacity-50">
                    {rebuildingId === app.id ? "Building..." : "Rebuild Schema"}
                  </button>
                  <button onClick={() => deleteApp(app.id)}
                    className="fm text-[10px] border border-[#1e1e1e] text-[#5a5a5a] px-3 py-1.5 hover:border-red-500 hover:text-red-400 transition-colors">
                    Delete
                  </button>
                </div>
              </div>

              {editingId === app.id && (
                <div className="mx-5 mb-5 border border-[#e8ff47]/30 bg-black p-4">
                  <div className="flex items-center justify-between gap-3 mb-4">
                    <div>
                      <p className="fd text-lg tracking-wide text-white">APP DATA</p>
                      <p className="fm text-[10px] text-[#5a5a5a]">Edit app name or database connection.</p>
                    </div>
                    {editSaved && (
                      <span className="fm text-[10px] text-[#e8ff47]">Saved</span>
                    )}
                  </div>

                  {editLoading ? (
                    <div className="fm text-xs text-[#5a5a5a] py-4">Loading app data...</div>
                  ) : (
                    <div className="space-y-3">
                      <div>
                        <label className="fm block text-[10px] text-[#5a5a5a] uppercase tracking-wider mb-1.5">App Name *</label>
                        <input
                          value={editForm.name}
                          onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                          className="w-full bg-[#0d0d0d] border border-[#1e1e1e] text-white px-4 py-2.5 text-sm focus:outline-none focus:border-[#e8ff47] transition-colors"
                        />
                      </div>
                      <div>
                        <label className="fm block text-[10px] text-[#5a5a5a] uppercase tracking-wider mb-1.5">Database URL *</label>
                        <textarea
                          value={editForm.dbUrl}
                          onChange={e => setEditForm(f => ({ ...f, dbUrl: e.target.value }))}
                          rows={3}
                          className="w-full bg-[#0d0d0d] border border-[#1e1e1e] text-white px-4 py-2.5 text-sm focus:outline-none focus:border-[#e8ff47] transition-colors font-mono resize-none"
                          dir="ltr"
                        />
                        <p className="fm text-[10px] text-[#3a3a3a] mt-1">Changing this clears the cached schema; click Rebuild Schema after saving.</p>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="fm block text-[10px] text-[#5a5a5a] uppercase tracking-wider mb-1.5">Origin</label>
                          <input
                            value={editForm.origin}
                            onChange={e => setEditForm(f => ({ ...f, origin: e.target.value }))}
                            placeholder="https://myerp.vercel.app"
                            className="w-full bg-[#0d0d0d] border border-[#1e1e1e] text-white px-4 py-2.5 text-sm focus:outline-none focus:border-[#e8ff47] transition-colors"
                          />
                        </div>
                        <div>
                          <label className="fm block text-[10px] text-[#5a5a5a] uppercase tracking-wider mb-1.5">DB Type</label>
                          <select
                            value={editForm.dbType}
                            onChange={e => setEditForm(f => ({ ...f, dbType: e.target.value }))}
                            className="w-full bg-[#0d0d0d] border border-[#1e1e1e] text-white px-4 py-2.5 text-sm focus:outline-none focus:border-[#e8ff47] transition-colors"
                          >
                            <option value="POSTGRESQL">PostgreSQL</option>
                            <option value="MYSQL">MySQL</option>
                          </select>
                        </div>
                      </div>

                      {editError && (
                        <p className="fm text-xs text-red-400">{editError}</p>
                      )}

                      <div className="flex flex-wrap gap-2 pt-1">
                        <button
                          onClick={saveDataEditor}
                          disabled={editSaving || !editForm.name.trim() || !editForm.dbUrl.trim()}
                          className="fd text-base tracking-wide px-6 py-2 text-black disabled:opacity-50 transition hover:-translate-y-0.5"
                          style={{ background: "#e8ff47" }}
                        >
                          {editSaving ? "SAVING..." : "SAVE DATA"}
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="fm text-xs border border-[#1e1e1e] text-[#5a5a5a] px-4 hover:border-[#e8ff47] hover:text-white transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Embed snippet */}
              <div className="mx-5 mb-5 bg-black border border-[#1e1e1e] p-3 relative">
                <p className="fm text-[10px] text-[#3a3a3a] mb-1.5">// Embed in your app before &lt;/body&gt;:</p>
                <code className="fm text-xs text-[#e8ff47] break-all">
                  {`<script src="${BASE_URL}/embed.js" data-api-key="${app.apiKey}" data-widget-mode="${widgetMode}" data-tenant-id="ERP_TENANT_ID" data-company-id="ERP_COMPANY_ID" data-user-id="ERP_USER_ID" data-user-email="USER_EMAIL"></script>`}
                </code>
                <button
                  onClick={() => copy(`<script src="${BASE_URL}/embed.js" data-api-key="${app.apiKey}" data-widget-mode="${widgetMode}" data-tenant-id="ERP_TENANT_ID" data-company-id="ERP_COMPANY_ID" data-user-id="ERP_USER_ID" data-user-email="USER_EMAIL"></script>`, app.id + "s")}
                  className="absolute top-3 right-3 fm text-[10px] bg-[#1e1e1e] text-[#5a5a5a] px-2 py-1 hover:text-[#e8ff47] transition-colors"
                >
                  {copied === app.id + "s" ? "✓" : "Copy"}
                </button>
              </div>
            </div>
          )})}
        </div>
      )}
    </div>
  );
}
