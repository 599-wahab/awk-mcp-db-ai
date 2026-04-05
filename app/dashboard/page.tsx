"use client";
import { useState, useRef, useEffect } from "react";
import Charts from "@/app/components/charts/Charts";

interface Message {
  id: string;
  content: string;
  isUser: boolean;
  timestamp: Date;
  sql?: string;
  result?: any[];
  visualization?: string;
  insights?: string[];
  isError?: boolean;
  errorType?: string;
}

interface App { id: string; name: string; apiKey: string; }

// ── Error Toast ───────────────────────────────────────────────────────────────
function ErrorToast({ message, errorType, onClose }: { message: string; errorType?: string; onClose: () => void }) {
  const isQuota = errorType === "QUOTA_EXCEEDED";
  const isNoKey = errorType === "NO_KEY";

  return (
    <div className="fixed top-4 right-4 z-50 max-w-sm border border-red-500/40 bg-black shadow-2xl p-4" style={{ fontFamily: "'Space Mono',monospace" }}>
      <div className="flex items-start gap-3">
        <span className="text-red-400 text-lg shrink-0">✕</span>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] text-red-400 uppercase tracking-wider mb-1">// Error</p>
          <p className="text-xs text-white leading-relaxed mb-2">{message}</p>
          {(isQuota || isNoKey) && (
            <a href="/dashboard/settings" className="text-[10px] underline" style={{ color: "#e8ff47" }}>
              → Go to Settings to update Gemini key
            </a>
          )}
        </div>
        <button onClick={onClose} className="text-[#3a3a3a] hover:text-white text-xs shrink-0">✕</button>
      </div>
    </div>
  );
}

// ── Voice ─────────────────────────────────────────────────────────────────────
function useVoice() {
  function listen(onResult: (t: string) => void, onEnd: () => void) {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { alert("Voice requires Chrome or Edge."); onEnd(); return () => {}; }
    const r = new SR();
    r.lang = "ur-PK"; r.interimResults = false;
    r.onresult = (e: any) => onResult(e.results[0][0].transcript);
    r.onerror = () => onEnd(); r.onend = () => onEnd();
    r.start();
    return () => { try { r.stop(); } catch {} };
  }
  function speak(text: string) {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    const v = window.speechSynthesis.getVoices().find(v => v.lang.startsWith("ur"));
    if (v) u.voice = v;
    u.rate = 0.9;
    window.speechSynthesis.speak(u);
  }
  return { listen, speak };
}

export default function DashboardPage() {
  const [apps, setApps] = useState<App[]>([]);
  const [selectedKey, setSelectedKey] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [recording, setRecording] = useState(false);
  const [ttsOn, setTtsOn] = useState(false);
  const [viewTypes, setViewTypes] = useState<Record<string, string>>({});
  const [toast, setToast] = useState<{ message: string; errorType?: string } | null>(null);
  const stopRef = useRef<(() => void) | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const { listen, speak } = useVoice();

  useEffect(() => {
    fetch("/api/widget/register").then(r => r.json()).then(data => {
      if (Array.isArray(data) && data.length > 0) { setApps(data); setSelectedKey(data[0].apiKey); }
    }).catch(() => {});
  }, []);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  // Auto-hide toast after 8 seconds
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 8000);
    return () => clearTimeout(t);
  }, [toast]);

  async function ask(text: string) {
    if (!text.trim() || !selectedKey) return;
    setMessages(m => [...m, { id: Date.now().toString(), content: text, isUser: true, timestamp: new Date() }]);
    setQuestion("");
    setLoading(true);

    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": selectedKey },
        body: JSON.stringify({ question: text }),
      });
      const data = await res.json();

      if (!res.ok || data.error) {
        // Show toast for errors
        setToast({ message: data.error, errorType: data.errorType });
        setMessages(m => [...m, {
          id: (Date.now() + 1).toString(),
          content: data.error || "An error occurred.",
          isUser: false, timestamp: new Date(),
          isError: true, errorType: data.errorType,
        }]);
      } else {
        const msg: Message = {
          id: (Date.now() + 1).toString(),
          content: data.explanation || "Done.",
          isUser: false, timestamp: new Date(),
          sql: data.sql, result: data.result,
          visualization: data.visualization, insights: data.insights,
        };
        setMessages(m => [...m, msg]);
        if (ttsOn && data.explanation) speak(data.explanation);
      }
    } catch {
      setToast({ message: "Network error. Check your connection." });
      setMessages(m => [...m, { id: Date.now().toString(), content: "Network error.", isUser: false, timestamp: new Date(), isError: true }]);
    }
    setLoading(false);
  }

  function handleMic() {
    if (recording) { stopRef.current?.(); setRecording(false); return; }
    setRecording(true);
    stopRef.current = listen(t => { setRecording(false); ask(t); }, () => setRecording(false));
  }

  function getViz(id: string, def: string) { return viewTypes[id] ?? def ?? "line"; }

  return (
    <div className="flex flex-col h-[calc(100vh-5rem)]" style={{ fontFamily: "'DM Sans',sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Space+Mono:wght@400;700&family=DM+Sans:wght@300;400;500;600&display=swap');.fd{font-family:'Bebas Neue',sans-serif;}.fm{font-family:'Space Mono',monospace;}`}</style>

      {toast && <ErrorToast message={toast.message} errorType={toast.errorType} onClose={() => setToast(null)} />}

      <div className="flex flex-col h-full border border-[#1e1e1e] bg-[#0d0d0d] overflow-hidden">
        {/* Toolbar */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-[#1e1e1e] shrink-0">
          {apps.length > 0 ? (
            <select value={selectedKey} onChange={e => setSelectedKey(e.target.value)}
              className="fm text-xs bg-black border border-[#1e1e1e] text-white px-3 py-1.5 focus:outline-none focus:border-[#e8ff47] transition-colors">
              {apps.map(a => <option key={a.id} value={a.apiKey}>{a.name}</option>)}
            </select>
          ) : (
            <a href="/dashboard/widget-sites" className="fm text-xs border border-[#e8ff47]/30 text-[#e8ff47] px-3 py-1.5 hover:bg-[#e8ff47]/5 transition-colors">
              ⚠ No apps — Connect one →
            </a>
          )}
          <div className="flex-1" />
          <label className="flex items-center gap-2 fm text-[10px] text-[#5a5a5a] cursor-pointer">
            <input type="checkbox" checked={ttsOn} onChange={e => setTtsOn(e.target.checked)} className="accent-[#e8ff47]" />
            Voice replies
          </label>
          {messages.length > 0 && (
            <button onClick={() => setMessages([])}
              className="fm text-[10px] text-[#3a3a3a] hover:text-[#5a5a5a] border border-[#1e1e1e] px-2 py-1 hover:border-[#2a2a2a] transition-colors">
              Clear
            </button>
          )}
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center gap-4">
              <div className="fd text-7xl text-[#1e1e1e]">ASK</div>
              <p className="text-[#5a5a5a] text-sm">اردو یا English میں سوال پوچھیں</p>
              <div className="grid grid-cols-2 gap-2 max-w-lg">
                {["آج کی total sales کتنی ہے؟","Show monthly revenue chart","Kitne pending orders hain?","Top 5 products by quantity"].map(q => (
                  <button key={q} onClick={() => ask(q)}
                    className="fm text-[10px] text-[#3a3a3a] border border-[#1e1e1e] px-3 py-2 hover:border-[#e8ff47] hover:text-[#e8ff47] transition-colors text-left" dir="auto">
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map(msg => (
            <div key={msg.id} className={`flex ${msg.isUser ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[85%] ${msg.isUser ? "text-black" : msg.isError ? "bg-red-500/10 border border-red-500/30 text-white" : "bg-black border border-[#1e1e1e] text-white"}`}
                style={msg.isUser ? { background: "#e8ff47", borderRadius: 0 } : { borderRadius: 0 }}>
                <div className="px-4 py-3">
                  <p className={`fm text-[9px] mb-1.5 ${msg.isUser ? "text-black/50" : msg.isError ? "text-red-400" : "text-[#3a3a3a]"}`}>
                    {msg.isUser ? "YOU" : msg.isError ? "ERROR" : "AWKT-LD BOT"} • {new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </p>
                  <p className="text-sm whitespace-pre-wrap leading-relaxed" dir="auto">{msg.content}</p>

                  {msg.isError && (msg.errorType === "QUOTA_EXCEEDED" || msg.errorType === "NO_KEY" || msg.errorType === "INVALID_KEY") && (
                    <a href="/dashboard/settings" className="fm text-[10px] underline mt-2 block" style={{ color: "#e8ff47" }}>
                      → Fix in Settings
                    </a>
                  )}

                  {!msg.isUser && !msg.isError && msg.visualization === "kpi" && msg.result?.[0] && (
                    <div className="fd text-4xl mt-3" style={{ color: "#e8ff47" }}>{String(Object.values(msg.result[0])[0])}</div>
                  )}

                  {!msg.isUser && !msg.isError && msg.result && msg.visualization && !["kpi","table","none"].includes(msg.visualization) && (
                    <div className="mt-4">
                      <div className="flex gap-1 mb-3">
                        {["line","bar","stacked","pie"].map(t => (
                          <button key={t} onClick={() => setViewTypes(v => ({ ...v, [msg.id]: t }))}
                            className={`fm text-[9px] px-2.5 py-1 border transition-colors ${getViz(msg.id, msg.visualization!) === t ? "border-[#e8ff47] text-[#e8ff47]" : "border-[#1e1e1e] text-[#5a5a5a] hover:border-[#e8ff47]"}`}>
                            {t.toUpperCase()}
                          </button>
                        ))}
                      </div>
                      <Charts data={msg.result} type={getViz(msg.id, msg.visualization)} />
                    </div>
                  )}

                  {!msg.isUser && !msg.isError && msg.visualization === "table" && msg.result && (
                    <div className="overflow-x-auto mt-3">
                      <table className="min-w-full border border-[#1e1e1e] fm text-xs">
                        <thead><tr className="border-b border-[#1e1e1e]">{Object.keys(msg.result[0]).map(c => <th key={c} className="px-3 py-2 text-left text-[#5a5a5a] font-normal uppercase tracking-wider text-[9px]">{c}</th>)}</tr></thead>
                        <tbody>{msg.result.map((row, i) => <tr key={i} className={`border-b border-[#0d0d0d] ${i%2?"bg-[#0a0a0a]":""}`}>{Object.values(row).map((v, j) => <td key={j} className="px-3 py-2 text-[#5a5a5a]">{String(v)}</td>)}</tr>)}</tbody>
                      </table>
                    </div>
                  )}

                  {!msg.isUser && !msg.isError && msg.insights?.length ? (
                    <div className="mt-3 space-y-1 border-t border-[#1e1e1e] pt-3">
                      {msg.insights.map((ins, i) => <p key={i} className="fm text-[10px] text-[#e8ff47]">▸ {ins}</p>)}
                    </div>
                  ) : null}

                  {!msg.isUser && !msg.isError && msg.sql && (
                    <details className="mt-3">
                      <summary className="fm text-[10px] text-[#3a3a3a] cursor-pointer hover:text-[#5a5a5a]">// View SQL</summary>
                      <pre className="bg-black border border-[#1e1e1e] text-[#e8ff47] fm text-[10px] p-3 mt-2 overflow-x-auto">{msg.sql}</pre>
                    </details>
                  )}
                </div>
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="bg-black border border-[#1e1e1e] px-4 py-3">
                <div className="flex gap-1">{[0,150,300].map(d => <div key={d} className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: "#e8ff47", animationDelay: `${d}ms` }} />)}</div>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="px-4 pb-4 pt-3 border-t border-[#1e1e1e] shrink-0">
          <div className="flex gap-2 items-center">
            <input value={question} onChange={e => setQuestion(e.target.value)}
              onKeyDown={e => e.key === "Enter" && !loading && ask(question)}
              placeholder="اردو یا English میں سوال پوچھیں..." dir="auto"
              className="flex-1 bg-black border border-[#1e1e1e] text-white px-4 py-3 text-sm focus:outline-none focus:border-[#e8ff47] transition-colors" />
            <button onClick={handleMic}
              className={`p-3 border transition-colors ${recording ? "animate-pulse text-black" : "border-[#1e1e1e] text-[#5a5a5a] hover:border-[#e8ff47] hover:text-[#e8ff47]"}`}
              style={recording ? { background: "#e8ff47", borderColor: "#e8ff47" } : {}}>
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                {recording ? <rect x="6" y="6" width="12" height="12" rx="1" /> : <><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2H3v2a9 9 0 0 0 8 8.94V22h-3v2h8v-2h-3v-1.06A9 9 0 0 0 21 12v-2h-2z"/></>}
              </svg>
            </button>
            <button onClick={() => ask(question)} disabled={loading || !question.trim()}
              className="fd text-lg tracking-wide px-6 py-3 text-black disabled:opacity-40 transition hover:-translate-y-0.5"
              style={{ background: "#e8ff47" }}>
              ASK
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}