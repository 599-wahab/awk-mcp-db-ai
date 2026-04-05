"use client";
import { useState, useRef, useEffect } from "react";
import { startVoiceInput, speak } from "@/lib/voice";
import Charts from "../charts/Charts";

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

export default function ChatBox() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [recording, setRecording] = useState(false);
  const [ttsOn, setTtsOn] = useState(false);
  const [viewTypes, setViewTypes] = useState<Record<string, string>>({});
  const [selectedAppKey, setSelectedAppKey] = useState<string>("");
  const [apps, setApps] = useState<{ id: string; name: string; apiKey: string }[]>([]);
  const stopRecRef = useRef<(() => void) | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/widget/register").then(r => r.json()).then(data => {
      if (Array.isArray(data)) {
        setApps(data);
        if (data.length > 0) setSelectedAppKey(data[0].apiKey);
      }
    }).catch(() => {});
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function ask(text: string) {
    if (!text.trim()) return;
    if (!selectedAppKey) {
      alert("Please connect an app first from 'Connected Apps' in the sidebar.");
      return;
    }

    setMessages(m => [...m, { id: Date.now().toString(), content: text, isUser: true, timestamp: new Date() }]);
    setQuestion("");
    setLoading(true);

    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": selectedAppKey },
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
      setMessages(m => [...m, { id: Date.now().toString(), content: "Connection error.", isUser: false, timestamp: new Date() }]);
    }
    setLoading(false);
  }

  function handleMic() {
    if (recording) {
      stopRecRef.current?.();
      setRecording(false);
      return;
    }
    setRecording(true);
    const stop = startVoiceInput(
      (text) => { setRecording(false); ask(text); },
      () => setRecording(false)
    );
    stopRecRef.current = stop;
  }

  function getViz(msgId: string, def: string) {
    return viewTypes[msgId] ?? def ?? "line";
  }

  return (
    <div className="flex flex-col h-[calc(100vh-5rem)] bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 shrink-0">
        {apps.length > 0 ? (
          <select value={selectedAppKey} onChange={e => setSelectedAppKey(e.target.value)}
            className="text-sm border border-gray-200 rounded-xl px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-gray-50">
            {apps.map(a => <option key={a.id} value={a.apiKey}>{a.name}</option>)}
          </select>
        ) : (
          <span className="text-xs text-amber-600 bg-amber-50 px-3 py-1.5 rounded-xl">
            ⚠️ No apps connected — go to Connected Apps
          </span>
        )}
        <div className="flex-1" />
        <label className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer">
          <input type="checkbox" checked={ttsOn} onChange={e => setTtsOn(e.target.checked)} className="rounded" />
          Voice replies
        </label>
        {messages.length > 0 && (
          <button onClick={() => setMessages([])} className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1 rounded-lg hover:bg-gray-100 transition-colors">
            Clear
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center gap-3">
            <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center text-2xl">💬</div>
            <p className="font-medium text-gray-700">اردو یا English میں سوال پوچھیں</p>
            <p className="text-sm text-gray-400">e.g. "آج کی total sales کتنی ہے؟" or "Show me monthly revenue"</p>
          </div>
        )}
        {messages.map(msg => (
          <div key={msg.id} className={`flex ${msg.isUser ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[85%] rounded-2xl px-4 py-3 ${msg.isUser ? "bg-indigo-600 text-white rounded-br-sm" : "bg-gray-50 border border-gray-200 rounded-bl-sm"}`}>
              <p className="text-xs opacity-50 mb-1.5">{msg.isUser ? "You" : "AWKT-LD"} • {new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</p>
              <p className="text-sm whitespace-pre-wrap" dir="auto">{msg.content}</p>

              {!msg.isUser && msg.visualization === "kpi" && msg.result?.[0] && (
                <div className="text-3xl font-bold text-indigo-600 mt-2">
                  {String(Object.values(msg.result[0])[0])}
                </div>
              )}

              {!msg.isUser && msg.result && msg.visualization && !["kpi", "table", "none"].includes(msg.visualization) && (
                <div className="mt-3">
                  <div className="flex gap-1 mb-2">
                    {["line", "bar", "stacked", "pie"].map(t => (
                      <button key={t} onClick={() => setViewTypes(v => ({ ...v, [msg.id]: t }))}
                        className={`text-xs px-2.5 py-1 rounded-lg ${getViz(msg.id, msg.visualization!) === t ? "bg-indigo-600 text-white" : "bg-gray-200 text-gray-600 hover:bg-gray-300"}`}>
                        {t}
                      </button>
                    ))}
                  </div>
                  <Charts data={msg.result} type={getViz(msg.id, msg.visualization)} />
                </div>
              )}

              {!msg.isUser && msg.visualization === "table" && msg.result && (
                <div className="overflow-x-auto mt-3 text-sm">
                  <table className="min-w-full border border-gray-200 rounded-xl overflow-hidden">
                    <thead className="bg-gray-100">
                      <tr>{Object.keys(msg.result[0]).map(c => <th key={c} className="px-3 py-2 text-left text-xs font-medium text-gray-600">{c}</th>)}</tr>
                    </thead>
                    <tbody>
                      {msg.result.map((row, i) => (
                        <tr key={i} className={i % 2 ? "bg-gray-50" : "bg-white"}>
                          {Object.values(row).map((v, j) => <td key={j} className="px-3 py-2 text-xs text-gray-700">{String(v)}</td>)}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {!msg.isUser && msg.insights?.length ? (
                <div className="mt-2 space-y-1">
                  {msg.insights.map((ins, i) => <p key={i} className="text-xs text-indigo-600">📌 {ins}</p>)}
                </div>
              ) : null}

              {!msg.isUser && msg.sql && (
                <details className="mt-2">
                  <summary className="text-xs text-gray-400 cursor-pointer hover:text-gray-600">View SQL</summary>
                  <pre className="bg-gray-900 text-green-400 text-xs p-3 rounded-xl mt-1.5 overflow-x-auto">{msg.sql}</pre>
                </details>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-gray-50 border border-gray-200 rounded-2xl rounded-bl-sm px-4 py-3">
              <div className="flex gap-1 items-center">
                {[0, 150, 300].map(d => <div key={d} className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: `${d}ms` }} />)}
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="p-3 border-t border-gray-100 shrink-0">
        <div className="flex gap-2 items-center">
          <input value={question} onChange={e => setQuestion(e.target.value)}
            onKeyDown={e => e.key === "Enter" && !loading && ask(question)}
            placeholder="اردو یا English میں سوال پوچھیں..."
            dir="auto"
            className="flex-1 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-gray-50" />
          <button onClick={handleMic}
            className={`p-3 rounded-xl border transition-colors ${recording ? "bg-red-500 border-red-500 text-white animate-pulse" : "border-gray-200 text-gray-400 hover:bg-gray-50"}`}>
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              {recording
                ? <rect x="6" y="6" width="12" height="12" rx="2" />
                : <><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" /><path d="M19 10v2a7 7 0 0 1-14 0v-2H3v2a9 9 0 0 0 8 8.94V22h-3v2h8v-2h-3v-1.06A9 9 0 0 0 21 12v-2h-2z" /></>
              }
            </svg>
          </button>
          <button onClick={() => ask(question)} disabled={loading || !question.trim()}
            className="bg-indigo-600 text-white px-5 py-3 rounded-xl text-sm font-medium hover:bg-indigo-700 disabled:opacity-40 transition-colors">
            Ask
          </button>
        </div>
      </div>
    </div>
  );
}