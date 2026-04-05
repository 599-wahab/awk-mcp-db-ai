// app\dashboard\page.tsx
"use client";
import { useSearchParams, useRouter } from "next/navigation";
import { Suspense, useState, useRef, useEffect } from "react";
import { startVoiceInput, speak } from "@/lib/voice";
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
}

function WidgetChat() {
  const params = useSearchParams();
  const apiKey = params.get("key") || "";

  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      content: "السلام علیکم! میں آپ کا AI database assistant ہوں۔ اردو یا English میں سوال پوچھیں۔\n\nHello! Ask me anything about your data in Urdu or English.",
      isUser: false,
      timestamp: new Date(),
    },
  ]);
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [recording, setRecording] = useState(false);
  const [ttsOn, setTtsOn] = useState(true);
  const [viewTypes, setViewTypes] = useState<Record<string, string>>({});
  const stopRecRef = useRef<(() => void) | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const apiUrl = typeof window !== "undefined"
    ? `${window.location.origin}/api/ai`
    : "/api/ai";

  async function ask(text: string) {
    if (!text.trim()) return;
    const userMsg: Message = { id: Date.now().toString(), content: text, isUser: true, timestamp: new Date() };
    setMessages(m => [...m, userMsg]);
    setQuestion("");
    setLoading(true);

    try {
      const res = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": apiKey },
        body: JSON.stringify({ question: text }),
      });
      const data = await res.json();
      const aiMsg: Message = {
        id: (Date.now() + 1).toString(),
        content: data.explanation || data.error || "Something went wrong.",
        isUser: false,
        timestamp: new Date(),
        sql: data.sql,
        result: data.result,
        visualization: data.visualization,
        insights: data.insights,
      };
      setMessages(m => [...m, aiMsg]);
      if (ttsOn && data.explanation) speak(data.explanation);
    } catch {
      setMessages(m => [...m, { id: Date.now().toString(), content: "Connection error. Please try again.", isUser: false, timestamp: new Date() }]);
    }
    setLoading(false);
  }

  function handleMic() {
    if (recording) {
      stopRecRef.current?.();
      setRecording(false);
      stopRecRef.current = null;
      return;
    }
    setRecording(true);
    const stop = startVoiceInput(
      (text) => { setRecording(false); stopRecRef.current = null; ask(text); },
      (err) => { setRecording(false); stopRecRef.current = null; console.error(err); }
    );
    stopRecRef.current = stop;
  }

  function getViewType(msgId: string, def: string) {
    return viewTypes[msgId] ?? def ?? "line";
  }

  return (
    <div className="h-screen flex flex-col bg-white overflow-hidden">
      {/* Header */}
      <div className="bg-indigo-600 px-4 py-3 flex items-center gap-3 shrink-0">
        <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center text-white font-bold text-sm">AW</div>
        <div className="flex-1 min-w-0">
          <p className="text-white font-semibold text-sm leading-none">AWKT-LD</p>
          <p className="text-indigo-200 text-xs mt-0.5">اردو / English • AI Assistant</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setTtsOn(v => !v)}
            className={`text-xs px-2 py-1 rounded-lg transition-colors ${ttsOn ? "bg-white/20 text-white" : "bg-white/10 text-indigo-300"}`}
            title="Toggle voice replies">
            {ttsOn ? "🔊" : "🔇"}
          </button>
          <div className="w-2 h-2 bg-green-400 rounded-full" />
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
        {messages.map(msg => (
          <div key={msg.id} className={`flex ${msg.isUser ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[90%] rounded-2xl px-3 py-2.5 ${msg.isUser ? "bg-indigo-600 text-white rounded-br-sm" : "bg-gray-100 text-gray-800 rounded-bl-sm"}`}>
              <p className="text-xs opacity-50 mb-1">{msg.isUser ? "You" : "AWKT-LD"} • {new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</p>
              <p className="text-sm whitespace-pre-wrap" dir="auto">{msg.content}</p>

              {/* KPI */}
              {!msg.isUser && msg.visualization === "kpi" && msg.result?.length === 1 && (
                <div className="text-2xl font-bold text-indigo-600 mt-2">
                  {String(Object.values(msg.result[0])[0])}
                </div>
              )}

              {/* Chart type switcher + chart */}
              {!msg.isUser && msg.result && msg.visualization && !["kpi", "table", "none"].includes(msg.visualization) && (
                <div className="mt-3">
                  <div className="flex gap-1 mb-2 flex-wrap">
                    {["line", "bar", "stacked", "pie"].map(t => (
                      <button key={t} onClick={() => setViewTypes(v => ({ ...v, [msg.id]: t }))}
                        className={`text-xs px-2 py-1 rounded-lg transition-colors ${getViewType(msg.id, msg.visualization!) === t ? "bg-indigo-600 text-white" : "bg-gray-200 text-gray-600 hover:bg-gray-300"}`}>
                        {t}
                      </button>
                    ))}
                  </div>
                  <Charts data={msg.result} type={getViewType(msg.id, msg.visualization)} />
                </div>
              )}

              {/* Table */}
              {!msg.isUser && msg.visualization === "table" && msg.result && (
                <div className="overflow-x-auto mt-2 text-xs">
                  <table className="min-w-full border border-gray-200 rounded-lg overflow-hidden">
                    <thead className="bg-gray-200">
                      <tr>{Object.keys(msg.result[0]).map(c => <th key={c} className="border-b px-2 py-1 text-left text-gray-700">{c}</th>)}</tr>
                    </thead>
                    <tbody>
                      {msg.result.map((row, i) => (
                        <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                          {Object.values(row).map((v, j) => <td key={j} className="px-2 py-1 text-gray-700">{String(v)}</td>)}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Insights */}
              {!msg.isUser && msg.insights?.length ? (
                <div className="mt-2 space-y-1">
                  {msg.insights.map((ins, i) => <p key={i} className="text-xs text-indigo-600">📌 {ins}</p>)}
                </div>
              ) : null}

              {/* SQL toggle */}
              {!msg.isUser && msg.sql && (
                <details className="mt-2">
                  <summary className="text-xs text-gray-400 cursor-pointer">View SQL</summary>
                  <pre className="bg-gray-800 text-green-400 text-xs p-2 rounded-lg mt-1 overflow-x-auto">{msg.sql}</pre>
                </details>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 rounded-2xl rounded-bl-sm px-4 py-3">
              <div className="flex gap-1 items-center">
                {[0, 150, 300].map(d => (
                  <div key={d} className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: `${d}ms` }} />
                ))}
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-3 pb-3 pt-2 border-t border-gray-100 shrink-0">
        <div className="flex gap-2 items-center">
          <input
            ref={inputRef}
            value={question}
            onChange={e => setQuestion(e.target.value)}
            onKeyDown={e => e.key === "Enter" && !loading && ask(question)}
            placeholder="اردو یا English میں لکھیں..."
            dir="auto"
            className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-gray-50"
          />
          <button onClick={handleMic}
            className={`p-2.5 rounded-xl border transition-colors ${recording ? "bg-red-500 border-red-500 text-white animate-pulse" : "border-gray-200 text-gray-400 hover:bg-gray-100"}`}>
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              {recording
                ? <rect x="6" y="6" width="12" height="12" rx="2" />
                : <><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" /><path d="M19 10v2a7 7 0 0 1-14 0v-2H3v2a9 9 0 0 0 8 8.94V22h-3v2h8v-2h-3v-1.06A9 9 0 0 0 21 12v-2h-2z" /></>
              }
            </svg>
          </button>
          <button onClick={() => ask(question)} disabled={loading || !question.trim()}
            className="bg-indigo-600 text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-indigo-700 disabled:opacity-40 transition-colors">
            Send
          </button>
        </div>
      </div>
    </div>
  );
}

export default function WidgetPage() {
  return (
    <Suspense fallback={<div className="h-screen flex items-center justify-center text-gray-400 text-sm">Loading...</div>}>
      <WidgetChat />
    </Suspense>
  );
}