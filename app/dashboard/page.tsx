"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import Charts from "@/app/components/charts/Charts";

// ── Types ─────────────────────────────────────────────────────────────────────
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
  detectedLang?: "ur" | "en";
  chatLogId?: string;
  feedback?: "like" | "dislike" | null;
}

interface App { id: string; name: string; apiKey: string; }

interface HistoryLog {
  id: string;
  question: string;
  explanation: string | null;
  generatedSql: string | null;
  result: string | null;
  feedback: string | null;
  detectedLang: string | null;
  createdAt: string;
  appId: string;
}

// ── Error Toast ───────────────────────────────────────────────────────────────
function ErrorToast({ message, errorType, onClose }: {
  message: string; errorType?: string; onClose: () => void;
}) {
  return (
    <div className="fixed top-3 right-3 z-50 w-[min(320px,calc(100vw-24px))] border border-red-500/40 bg-black shadow-2xl p-3 fm text-xs" role="alert">
      <div className="flex items-start gap-2">
        <span className="text-red-400 shrink-0 text-sm">✕</span>
        <div className="flex-1 min-w-0">
          <p className="text-[9px] text-red-400 uppercase tracking-wider mb-1">// Error</p>
          <p className="text-white leading-relaxed mb-2 wrap-break-word text-[11px]">{message}</p>
          {["QUOTA_EXCEEDED","NO_KEY","INVALID_KEY","MODEL_NOT_FOUND"].includes(errorType || "") && (
            <a href="/dashboard/settings" className="text-[10px] underline" style={{ color: "#e8ff47" }}>
              → Fix in Settings
            </a>
          )}
        </div>
        <button onClick={onClose} className="text-[#3a3a3a] hover:text-white shrink-0 text-xs">✕</button>
      </div>
    </div>
  );
}

// ── Mic animation overlay ─────────────────────────────────────────────────────
function MicOverlay({ onStop, isUr }: { onStop: () => void; isUr: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/90 backdrop-blur-sm"
      onClick={onStop}>
      <style>{`
        @keyframes ripple {
          0%   { transform: scale(1);   opacity: 0.6; }
          100% { transform: scale(2.5); opacity: 0; }
        }
        .ripple-1 { animation: ripple 1.5s ease-out infinite; }
        .ripple-2 { animation: ripple 1.5s ease-out 0.5s infinite; }
        .ripple-3 { animation: ripple 1.5s ease-out 1s infinite; }
      `}</style>

      <div className="relative flex items-center justify-center w-32 h-32 mb-6">
        <div className="ripple-1 absolute w-20 h-20 rounded-full border-2" style={{ borderColor: "#e8ff47" }} />
        <div className="ripple-2 absolute w-20 h-20 rounded-full border-2" style={{ borderColor: "#e8ff47" }} />
        <div className="ripple-3 absolute w-20 h-20 rounded-full border-2" style={{ borderColor: "#e8ff47" }} />
        <div className="relative w-20 h-20 rounded-full flex items-center justify-center" style={{ background: "#e8ff47" }}>
          <svg className="w-9 h-9 text-black" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
            <path d="M19 10v2a7 7 0 0 1-14 0v-2H3v2a9 9 0 0 0 8 8.94V22h-3v2h8v-2h-3v-1.06A9 9 0 0 0 21 12v-2h-2z"/>
          </svg>
        </div>
      </div>

      <p className="fd text-3xl tracking-widest mb-2" style={{ color: "#e8ff47" }}>
        {isUr ? "بول رہے ہیں..." : "LISTENING..."}
      </p>
      <p className="fm text-xs text-[#5a5a5a]">
        {isUr ? "بند کرنے کے لیے ٹیپ کریں" : "Tap anywhere to stop"}
      </p>
    </div>
  );
}

// ── Voice hook ────────────────────────────────────────────────────────────────
function useVoice() {
  function listen(onResult: (t: string) => void, onEnd: () => void, lang = "auto") {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { alert("Voice requires Chrome or Edge."); onEnd(); return () => {}; }
    const r = new SR();
    r.lang = lang === "ur" ? "ur-PK" : lang === "en" ? "en-US" : "ur-PK";
    r.interimResults = false; r.continuous = false;
    r.onresult = (e: any) => onResult(e.results[0][0].transcript);
    r.onerror = () => onEnd(); r.onend = () => onEnd();
    r.start();
    return () => { try { r.stop(); } catch {} };
  }
  function speak(text: string, lang = "auto") {
    window.speechSynthesis.cancel();
    const clean = text
      .replace(/\*\*(.*?)\*\*/g, "$1").replace(/\*(.*?)\*/g, "$1")
      .replace(/#{1,6}\s/g, "").replace(/`[^`]*`/g, "")
      .replace(/\d+\.\s/g, "").replace(/[-•]\s/g, "")
      .trim();
    const u = new SpeechSynthesisUtterance(clean);
    if (lang === "ur") {
      const v = window.speechSynthesis.getVoices().find(v => v.lang.startsWith("ur"));
      if (v) u.voice = v;
    } else if (lang === "en") {
      const v = window.speechSynthesis.getVoices().find(v => v.lang.startsWith("en"));
      if (v) u.voice = v;
    }
    u.rate = 0.88;
    window.speechSynthesis.speak(u);
  }
  return { listen, speak };
}

const TEXT_SIZES: Record<string, string> = { sm: "text-xs", md: "text-sm", lg: "text-base" };

// ── Group history by date ─────────────────────────────────────────────────────
function groupByDate(logs: HistoryLog[]) {
  const groups: Record<string, HistoryLog[]> = {};
  logs.forEach(l => {
    const d = new Date(l.createdAt);
    const today = new Date();
    const yesterday = new Date(); yesterday.setDate(today.getDate() - 1);
    let label: string;
    if (d.toDateString() === today.toDateString())     label = "Today";
    else if (d.toDateString() === yesterday.toDateString()) label = "Yesterday";
    else label = d.toLocaleDateString("en-PK", { day: "numeric", month: "short" });
    if (!groups[label]) groups[label] = [];
    groups[label].push(l);
  });
  return groups;
}

export default function DashboardPage() {
  const [apps, setApps] = useState<App[]>([]);
  const [selectedKey, setSelectedKey] = useState("");
  const [messages, setMessages]       = useState<Message[]>([]);
  const [question, setQuestion]       = useState("");
  const [loading, setLoading]         = useState(false);
  const [recording, setRecording]     = useState(false);
  const [ttsOn, setTtsOn]             = useState(false);
  const [viewTypes, setViewTypes]     = useState<Record<string, string>>({});
  const [toast, setToast]             = useState<{ message: string; errorType?: string } | null>(null);
  const [preferredLang, setPreferredLang] = useState("auto");
  const [textSize, setTextSize]       = useState("md");

  const [showHistory, setShowHistory]     = useState(false);
  const [history, setHistory]             = useState<HistoryLog[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const stopRef   = useRef<(() => void) | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLInputElement>(null);
  const { listen, speak } = useVoice();

  useEffect(() => {
    fetch("/api/widget/register")
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data) && data.length > 0) {
          setApps(data); setSelectedKey(data[0].apiKey);
        }
      }).catch(() => {});

    fetch("/api/user-preferences")
      .then(r => r.json())
      .then(d => {
        if (d.preferredLang) setPreferredLang(d.preferredLang);
        if (d.textSize)      setTextSize(d.textSize);
      }).catch(() => {});
  }, []);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 8000);
    return () => clearTimeout(t);
  }, [toast]);

  const isUr    = preferredLang === "ur";
  const msgSize = TEXT_SIZES[textSize] || "text-sm";

  useEffect(() => {
    if (!showHistory) return;
    setHistoryLoading(true);
    fetch("/api/chat-sessions")
      .then(r => r.json())
      .then(data => { setHistory(Array.isArray(data) ? data : []); })
      .catch(() => {})
      .finally(() => setHistoryLoading(false));
  }, [showHistory]);

  function restoreChat(log: HistoryLog) {
    const msgs: Message[] = [
      {
        id: `h-${log.id}-q`,
        content: log.question,
        isUser: true,
        timestamp: new Date(log.createdAt),
      },
      {
        id: `h-${log.id}-a`,
        content: log.explanation || (isUr ? "پرانا نتیجہ" : "Past result"),
        isUser: false,
        timestamp: new Date(log.createdAt),
        sql: log.generatedSql || undefined,
        result: log.result ? JSON.parse(log.result) : undefined,
        detectedLang: (log.detectedLang as "ur" | "en") || undefined,
        chatLogId: log.id,
        feedback: (log.feedback as "like" | "dislike" | null) || null,
      },
    ];
    setMessages(msgs);
    setShowHistory(false);
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  }

  async function sendFeedback(chatLogId: string, feedback: "like" | "dislike") {
    await fetch("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chatLogId, feedback }),
    }).catch(() => {});
    setMessages(prev => prev.map(m =>
      m.chatLogId === chatLogId
        ? { ...m, feedback: m.feedback === feedback ? null : feedback }
        : m
    ));
  }

  const ask = useCallback(async (text: string) => {
    if (!text.trim() || !selectedKey) return;
    setMessages(m => [...m, {
      id: Date.now().toString(), content: text, isUser: true, timestamp: new Date(),
    }]);
    setQuestion("");
    setLoading(true);

    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": selectedKey },
        body: JSON.stringify({ question: text, preferredLang }),
      });
      const data = await res.json();

      if (!res.ok || data.error) {
        setToast({ message: data.error, errorType: data.errorType });
        setMessages(m => [...m, {
          id:(Date.now()+1).toString(), content:data.explanation,
          isUser:false, timestamp:new Date(), isClarification:true,
          detectedLang:data.detectedLang,
        }]);
      } else {
        setMessages(m => [...m, {
          id: (Date.now() + 1).toString(),
          content: data.explanation || (isUr ? "ہو گیا۔" : "Done."),
          isUser: false, timestamp: new Date(),
          sql: data.sql, result: data.result,
          visualization: data.visualization,
          insights: data.insights,
          detectedLang: data.detectedLang,
          chatLogId: data.chatLogId,
          feedback: null,
        }]);
        if (ttsOn && data.explanation) speak(data.explanation);
      }
    } catch {
      setToast({ message: "Network error. Check your connection." });
      setMessages(m => [...m, {
        id: Date.now().toString(), content: "Network error.",
        isUser: false, timestamp: new Date(), isError: true,
      }]);
    }
    setLoading(false);
  }, [selectedKey, preferredLang, ttsOn, isUr, speak]);

  function handleMic() {
    if (recording) { stopRef.current?.(); setRecording(false); return; }
    setRecording(true);
    stopRef.current = listen(
      t => { setRecording(false); ask(t); },
      () => setRecording(false)
    );
  }

  function getViz(id: string, def: string) { return viewTypes[id] ?? def ?? "line"; }

  const SUGGESTIONS = isUr
    ? ["آج کی total sales کتنی ہے؟", "ماہانہ آمدنی کا چارٹ", "کتنے orders pending ہیں؟", "سب سے زیادہ بکنے والی مصنوعات"]
    : ["Today's total sales", "Monthly revenue chart", "How many pending orders?", "Top 5 products by quantity"];

  const grouped = groupByDate(history);

  return (
    <div className={`flex h-[calc(100dvh-57px)] overflow-hidden ${msgSize}`} style={{ fontFamily: "'DM Sans',sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Space+Mono:wght@400;700&family=DM+Sans:wght@300;400;500;600&display=swap');
        .fd{font-family:'Bebas Neue',sans-serif;}
        .fm{font-family:'Space Mono',monospace;}
      `}</style>

      {recording && <MicOverlay onStop={handleMic} isUr={isUr} />}

      {toast && <ErrorToast message={toast.message} errorType={toast.errorType} onClose={() => setToast(null)} />}

      {/* History sidebar */}
      {showHistory && (
        <div
          className="fixed inset-0 z-40 lg:static lg:inset-auto lg:z-auto flex"
          onClick={e => { if (e.target === e.currentTarget) setShowHistory(false); }}
        >
          <div className="absolute inset-0 bg-black/70 lg:hidden" onClick={() => setShowHistory(false)} />

          <aside className="relative z-10 w-72 max-w-[85vw] lg:w-64 xl:w-72 h-full border-r border-[#1e1e1e] bg-[#080808] flex flex-col shrink-0">
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#1e1e1e]">
              <p className="fm text-[10px] text-[#e8ff47] uppercase tracking-wider">
                // {isUr ? "پرانی گفتگو" : "Chat History"}
              </p>
              <button onClick={() => setShowHistory(false)} className="text-[#3a3a3a] hover:text-white text-xs">✕</button>
            </div>

            <button
              onClick={() => { setMessages([]); setShowHistory(false); inputRef.current?.focus(); }}
              className="mx-3 mt-3 mb-1 fd text-sm tracking-wider py-2 text-black transition hover:opacity-90"
              style={{ background: "#e8ff47" }}
            >
              + {isUr ? "نئی گفتگو" : "NEW CHAT"}
            </button>

            <div className="flex-1 overflow-y-auto py-2">
              {historyLoading ? (
                <p className="fm text-[10px] text-[#3a3a3a] text-center py-8">// Loading...</p>
              ) : history.length === 0 ? (
                <p className="fm text-[10px] text-[#3a3a3a] text-center py-8">// No history yet</p>
              ) : (
                Object.entries(grouped).map(([date, logs]) => (
                  <div key={date}>
                    <p className="fm text-[9px] text-[#3a3a3a] uppercase tracking-wider px-4 py-2">{date}</p>
                    {logs.map(log => (
                      <button
                        key={log.id}
                        onClick={() => restoreChat(log)}
                        className="w-full text-left px-4 py-2.5 hover:bg-[#1a1a1a] transition-colors group"
                      >
                        <p className={`text-xs text-white truncate leading-snug group-hover:text-[#e8ff47] transition-colors`} dir="auto">
                          {log.question}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <p className="fm text-[9px] text-[#3a3a3a]">
                            {new Date(log.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </p>
                          {log.feedback === "like"    && <span className="text-[9px]">👍</span>}
                          {log.feedback === "dislike" && <span className="text-[9px]">👎</span>}
                          {log.detectedLang && (
                            <span className="fm text-[8px] text-[#3a3a3a]">[{log.detectedLang}]</span>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                ))
              )}
            </div>
          </aside>
        </div>
      )}

      {/* Main chat area */}
      <div className="flex flex-col flex-1 min-w-0 border border-[#1e1e1e] bg-[#0d0d0d] overflow-hidden">

        {/* Top toolbar */}
        <div className="flex items-center gap-2 px-3 py-2 border-b border-[#1e1e1e] shrink-0">
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="fm text-[10px] border border-[#1e1e1e] text-[#5a5a5a] px-2.5 py-1.5 hover:border-[#e8ff47] hover:text-[#e8ff47] transition-colors shrink-0"
            title={isUr ? "پرانی گفتگو" : "Chat History"}
          >
            ☰
          </button>

          {apps.length > 0 ? (
            <select
              value={selectedKey} onChange={e => setSelectedKey(e.target.value)}
              className="fm text-xs bg-black border border-[#1e1e1e] text-white px-2 py-1.5 focus:outline-none focus:border-[#e8ff47] transition-colors flex-1 min-w-0 max-w-40 truncate"
            >
              {apps.map(a => <option key={a.id} value={a.apiKey}>{a.name}</option>)}
            </select>
          ) : (
            <a href="/dashboard/widget-sites"
              className="fm text-[10px] border border-[#e8ff47]/30 text-[#e8ff47] px-2 py-1.5 hover:bg-[#e8ff47]/5 transition-colors truncate">
              ⚠ {isUr ? "ایپ شامل کریں" : "No apps"}
            </a>
          )}

          {preferredLang !== "auto" && (
            <span className="fm text-[9px] border border-[#e8ff47]/30 text-[#e8ff47] px-2 py-1 shrink-0">
              {preferredLang === "ur" ? "اردو" : "EN"}
            </span>
          )}

          <div className="flex-1" />

          <label className="flex items-center gap-1 fm text-[10px] text-[#5a5a5a] cursor-pointer shrink-0">
            <input type="checkbox" checked={ttsOn} onChange={e => setTtsOn(e.target.checked)} className="accent-[#e8ff47]" />
            <span className="hidden sm:inline">{isUr ? "آواز" : "Voice"}</span>
            <span className="sm:hidden">🔊</span>
          </label>

          {messages.length > 0 && (
            <button
              onClick={() => setMessages([])}
              className="fm text-[10px] text-[#3a3a3a] hover:text-[#5a5a5a] border border-[#1e1e1e] px-2 py-1 hover:border-[#2a2a2a] transition-colors shrink-0"
            >
              {isUr ? "صاف" : "Clear"}
            </button>
          )}
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3 scroll-smooth">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center gap-4 px-4 py-8">
              <div className="fd text-[clamp(3rem,12vw,6rem)] text-[#1e1e1e] leading-none">ASK</div>
              <p className="text-[#5a5a5a] text-sm" dir="auto">
                {isUr ? "اردو یا English میں سوال پوچھیں" : "Ask in Urdu or English"}
              </p>
              <div className="grid grid-cols-1 xs:grid-cols-2 gap-2 w-full max-w-sm">
                {SUGGESTIONS.map(q => (
                  <button key={q} onClick={() => ask(q)}
                    className="fm text-[10px] text-[#3a3a3a] border border-[#1e1e1e] px-3 py-2.5 hover:border-[#e8ff47] hover:text-[#e8ff47] transition-colors text-left leading-snug"
                    dir="auto">
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map(msg => {
            const msgIsUr = msg.detectedLang === "ur" || isUr;
            const isChartable = msg.result && msg.visualization && !["kpi","table","none"].includes(msg.visualization);
            const hasResult   = msg.result && msg.result.length > 0;

            return (
              <div key={msg.id} className={`flex ${msg.isUser ? "justify-end" : "justify-start"} items-end gap-1`}>
                <div
                  className={`
                    relative rounded-none
                    ${msg.isUser ? "max-w-[85%] sm:max-w-[70%]" : "w-full max-w-full sm:max-w-[90%]"}
                    ${msg.isUser ? "text-black"
                      : msg.isError ? "bg-red-500/10 border border-red-500/30 text-white"
                      : "bg-black border border-[#1e1e1e] text-white"}
                  `}
                  style={msg.isUser ? { background: "#e8ff47" } : {}}
                >
                  <div className="px-3 py-2.5">
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <p className={`fm text-[9px] ${msg.isUser ? "text-black/50" : msg.isError ? "text-red-400" : "text-[#3a3a3a]"}`}>
                        {msg.isUser ? (isUr ? "آپ" : "YOU")
                          : msg.isError ? "ERROR" : "AWKT-LD BOT"}
                        {" • "}
                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        {!msg.isUser && msg.detectedLang && (
                          <span className="ml-1.5 opacity-40">[{msg.detectedLang === "ur" ? "اردو" : "EN"}]</span>
                        )}
                      </p>
                    </div>

                    <p className={`whitespace-pre-wrap leading-relaxed ${msgSize}`} dir="auto">
                      {msg.content}
                    </p>

                    {msg.isError && ["QUOTA_EXCEEDED","NO_KEY","INVALID_KEY"].includes(msg.errorType || "") && (
                      <a href="/dashboard/settings" className="fm text-[10px] underline mt-2 block" style={{ color: "#e8ff47" }}>
                        → {isUr ? "Settings میں جائیں" : "Go to Settings"}
                      </a>
                    )}

                    {!msg.isUser && !msg.isError && msg.visualization === "kpi" && msg.result?.[0] && (
                      <div className="fd mt-2" style={{ color: "#e8ff47", fontSize: "clamp(2rem,8vw,3.5rem)" }}>
                        {String(Object.values(msg.result[0])[0])}
                      </div>
                    )}

                    {!msg.isUser && !msg.isError && isChartable && (
                      <div className="mt-3">
                        <div className="flex gap-1 mb-2 flex-wrap">
                          {["line","bar","stacked","pie"].map(t => (
                            <button key={t}
                              onClick={() => setViewTypes(v => ({ ...v, [msg.id]: t }))}
                              className={`fm text-[9px] px-2 py-1 border transition-colors ${
                                getViz(msg.id, msg.visualization!) === t
                                  ? "border-[#e8ff47] text-[#e8ff47]"
                                  : "border-[#1e1e1e] text-[#5a5a5a] hover:border-[#e8ff47]"
                              }`}>
                              {t.toUpperCase()}
                            </button>
                          ))}
                        </div>
                        <div className="w-full overflow-x-auto">
                          <Charts data={msg.result!} type={getViz(msg.id, msg.visualization!)} />
                        </div>
                      </div>
                    )}

                    {!msg.isUser && !msg.isError && msg.visualization === "table" && hasResult && (
                      <div className="overflow-x-auto mt-3 -mx-1">
                        <table className="min-w-full border border-[#1e1e1e] fm text-[10px]">
                          <thead>
                            <tr className="border-b border-[#1e1e1e]">
                              {Object.keys(msg.result![0]).map(c => (
                                <th key={c} className="px-2 py-1.5 text-left text-[#5a5a5a] font-normal uppercase tracking-wider whitespace-nowrap">{c}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {msg.result!.map((row, i) => (
                              <tr key={i} className={`border-b border-[#0d0d0d] ${i % 2 ? "bg-[#0a0a0a]" : ""}`}>
                                {Object.values(row).map((v, j) => (
                                  <td key={j} className="px-2 py-1.5 text-[#5a5a5a] whitespace-nowrap">{String(v)}</td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {!msg.isUser && !msg.isError && msg.insights?.length ? (
                      <div className="mt-2.5 space-y-1 border-t border-[#1e1e1e] pt-2">
                        {msg.insights.map((ins, i) => (
                          <p key={i} className="fm text-[10px] text-[#e8ff47]" dir="auto">▸ {ins}</p>
                        ))}
                      </div>
                    ) : null}

                    {!msg.isUser && !msg.isError && msg.sql && (
                      <details className="mt-2">
                        <summary className="fm text-[10px] text-[#3a3a3a] cursor-pointer hover:text-[#5a5a5a] select-none">
                          {isUr ? "// SQL دیکھیں" : "// View SQL"}
                        </summary>
                        <pre className="bg-black border border-[#1e1e1e] text-[#e8ff47] fm text-[10px] p-2 mt-1 overflow-x-auto whitespace-pre-wrap break-all max-h-40">{msg.sql}</pre>
                      </details>
                    )}

                    {!msg.isUser && !msg.isError && msg.chatLogId && (
                      <div className="flex items-center gap-2 mt-2.5 pt-2 border-t border-[#1e1e1e]">
                        <span className="fm text-[9px] text-[#3a3a3a]">
                          {isUr ? "کیسا جواب؟" : "Helpful?"}
                        </span>
                        <button
                          onClick={() => sendFeedback(msg.chatLogId!, "like")}
                          className={`fm text-[10px] px-2 py-1 border transition-colors ${
                            msg.feedback === "like"
                              ? "border-green-500 text-green-400 bg-green-500/10"
                              : "border-[#1e1e1e] text-[#5a5a5a] hover:border-green-500 hover:text-green-400"
                          }`}
                        >👍</button>
                        <button
                          onClick={() => sendFeedback(msg.chatLogId!, "dislike")}
                          className={`fm text-[10px] px-2 py-1 border transition-colors ${
                            msg.feedback === "dislike"
                              ? "border-red-500 text-red-400 bg-red-500/10"
                              : "border-[#1e1e1e] text-[#5a5a5a] hover:border-red-500 hover:text-red-400"
                          }`}
                        >👎</button>
                        {msg.feedback && (
                          <span className="fm text-[9px] text-[#5a5a5a]">
                            {msg.feedback === "like"
                              ? (isUr ? "پسند کیا" : "Liked")
                              : (isUr ? "ناپسند کیا" : "Disliked")}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-black border border-[#1e1e1e] px-4 py-3">
                <div className="flex gap-1.5 items-center">
                  {[0, 150, 300].map(d => (
                    <div key={d} className="w-1.5 h-1.5 rounded-full animate-bounce"
                      style={{ background: "#e8ff47", animationDelay: `${d}ms` }} />
                  ))}
                </div>
              </div>
            </div>
          )}
          <div ref={bottomRef}/>
        </div>

        {/* Input bar */}
        <div className="px-3 pb-safe-or-3 pt-2 border-t border-[#1e1e1e] shrink-0"
          style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom, 12px))" }}>
          <div className="flex gap-2 items-center">
            <input
              ref={inputRef}
              value={question}
              onChange={e => setQuestion(e.target.value)}
              onKeyDown={e => e.key === "Enter" && !loading && !e.shiftKey && ask(question)}
              placeholder={isUr ? "اردو یا English میں سوال پوچھیں..." : "Ask in Urdu or English..."}
              dir="auto"
              disabled={loading}
              className="flex-1 min-w-0 bg-black border border-[#1e1e1e] text-white px-3 py-2.5 text-sm focus:outline-none focus:border-[#e8ff47] transition-colors disabled:opacity-50"
              style={{ fontSize: "16px" }}
            />

            <button
              onClick={handleMic}
              disabled={loading}
              className="p-2.5 border transition-all shrink-0 disabled:opacity-40 border-[#1e1e1e] text-[#5a5a5a] hover:border-[#e8ff47] hover:text-[#e8ff47]"
              title={isUr ? "بولیں" : "Speak"}
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                {recording ? <rect x="6" y="6" width="12" height="12" rx="1" /> : <><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2H3v2a9 9 0 0 0 8 8.94V22h-3v2h8v-2h-3v-1.06A9 9 0 0 0 21 12v-2h-2z"/></>}
              </svg>
            </button>

            <button
              onClick={() => ask(question)}
              disabled={loading || !question.trim()}
              className="fd tracking-wide px-4 py-2.5 text-black disabled:opacity-40 transition hover:-translate-y-0.5 shrink-0"
              style={{ background: "#e8ff47", fontSize: "clamp(14px,4vw,18px)" }}
            >
              {isUr ? "پوچھیں" : "ASK"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}