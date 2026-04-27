"use client";
// app/widget/page.tsx — popup iframe loaded by embed.js

import { useSearchParams } from "next/navigation";
import { Suspense, useState, useRef, useEffect } from "react";
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
  const userId = params.get("userId") || "";
  const userEmail = params.get("userEmail") || "";

  const [messages, setMessages] = useState<Message[]>([
    {
      id: "w",
      content: userEmail
        ? `Welcome back, ${userEmail}! Ask me about your data.`
        : "السلام علیکم! اردو یا English میں سوال پوچھیں۔\nHello! Ask me anything about your data.",
      isUser: false,
      timestamp: new Date(),
    },
  ]);
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [recording, setRecording] = useState(false);
  const [ttsOn, setTtsOn] = useState(false);
  const [viewTypes, setViewTypes] = useState<Record<string, string>>({});
  const stopRef = useRef<(() => void) | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function startVoice(onResult: (t: string) => void, onEnd: () => void) {
    const SR =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;
    if (!SR) {
      onEnd();
      return () => {};
    }
    const r = new SR();
    r.lang = "ur-PK";
    r.interimResults = false;
    r.onresult = (e: any) => onResult(e.results[0][0].transcript);
    r.onerror = () => onEnd();
    r.onend = () => onEnd();
    r.start();
    return () => {
      try {
        r.stop();
      } catch {}
    };
  }

  function speakText(text: string) {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    const v = window.speechSynthesis
      .getVoices()
      .find((v) => v.lang.startsWith("ur"));
    if (v) u.voice = v;
    u.rate = 0.9;
    window.speechSynthesis.speak(u);
  }

  async function ask(text: string) {
    if (!text.trim()) return;
    setMessages((m) => [
      ...m,
      {
        id: Date.now().toString(),
        content: text,
        isUser: true,
        timestamp: new Date(),
      },
    ]);
    setQuestion("");
    setLoading(true);
    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      };
      if (userId) headers["x-user-id"] = userId;
      if (userEmail) headers["x-user-email"] = userEmail;

      const res = await fetch("/api/ai", {
        method: "POST",
        headers,
        body: JSON.stringify({ question: text }),
      });
      const data = await res.json();
      setMessages((m) => [
        ...m,
        {
          id: (Date.now() + 1).toString(),
          content: data.explanation || data.error || "Error occurred.",
          isUser: false,
          timestamp: new Date(),
          sql: data.sql,
          result: data.result,
          visualization: data.visualization,
          insights: data.insights,
        },
      ]);
      if (ttsOn && data.explanation) speakText(data.explanation);
    } catch {
      setMessages((m) => [
        ...m,
        {
          id: Date.now().toString(),
          content: "Connection error.",
          isUser: false,
          timestamp: new Date(),
        },
      ]);
    }
    setLoading(false);
  }

  function handleMic() {
    if (recording) {
      stopRef.current?.();
      setRecording(false);
      return;
    }
    setRecording(true);
    stopRef.current = startVoice(
      (t) => {
        setRecording(false);
        ask(t);
      },
      () => setRecording(false),
    );
  }

  function getViz(id: string, def: string) {
    return viewTypes[id] ?? def ?? "line";
  }

  return (
    <div
      className="h-screen flex flex-col bg-black text-white overflow-hidden"
      style={{ fontFamily: "'DM Sans',sans-serif" }}
    >
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Space+Mono:wght@400;700&family=DM+Sans:wght@300;400;500;600&display=swap');.fd{font-family:'Bebas Neue',sans-serif;}.fm{font-family:'Space Mono',monospace;}`}</style>

      {/* Header */}
      <div
        className="px-4 py-3 flex items-center gap-3 shrink-0 border-b border-[#1e1e1e]"
        style={{ background: "#e8ff47" }}
      >
        <div className="fd text-xl tracking-wider text-black">
          AWK<span className="opacity-60"> TLD</span>
        </div>
        <div className="flex-1">
          <p className="fm text-[10px] text-black/60 uppercase tracking-wider">
            BOT • اردو / English
          </p>
        </div>
        <button
          onClick={() => setTtsOn((v) => !v)}
          className="fm text-[10px] bg-black/10 text-black px-2 py-1 hover:bg-black/20 transition-colors"
        >
          {ttsOn ? "🔊" : "🔇"}
        </button>
        <div className="w-2 h-2 bg-black/30 rounded-full" />
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.isUser ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[90%] px-3 py-2.5 ${msg.isUser ? "text-black" : "bg-[#0d0d0d] border border-[#1e1e1e] text-white"}`}
              style={
                msg.isUser
                  ? { background: "#e8ff47", borderRadius: 0 }
                  : { borderRadius: 0 }
              }
            >
              <p
                className={`fm text-[9px] mb-1 ${msg.isUser ? "text-black/50" : "text-[#3a3a3a]"}`}
              >
                {msg.isUser ? "YOU" : "BOT"} •{" "}
                {new Date(msg.timestamp).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
              <p
                className="text-sm whitespace-pre-wrap leading-relaxed"
                dir="auto"
              >
                {msg.content}
              </p>

              {!msg.isUser &&
                msg.visualization === "kpi" &&
                msg.result?.length === 1 && (
                  <div
                    className="fd text-3xl mt-2"
                    style={{ color: "#e8ff47" }}
                  >
                    {String(Object.values(msg.result[0])[0])}
                  </div>
                )}

              {!msg.isUser &&
                msg.result &&
                msg.visualization &&
                !["kpi", "table", "none"].includes(msg.visualization) && (
                  <div className="mt-3">
                    <div className="flex gap-1 mb-2 flex-wrap">
                      {["line", "bar", "stacked", "pie"].map((t) => (
                        <button
                          key={t}
                          onClick={() =>
                            setViewTypes((v) => ({ ...v, [msg.id]: t }))
                          }
                          className={`fm text-[9px] px-2 py-0.5 border transition-colors ${getViz(msg.id, msg.visualization!) === t ? "border-[#e8ff47] text-[#e8ff47]" : "border-[#1e1e1e] text-[#5a5a5a]"}`}
                        >
                          {t.toUpperCase()}
                        </button>
                      ))}
                    </div>
                    <Charts
                      data={msg.result}
                      type={getViz(msg.id, msg.visualization)}
                    />
                  </div>
                )}

              {!msg.isUser && msg.visualization === "table" && msg.result && (
                <div className="overflow-x-auto mt-2">
                  <table className="min-w-full border border-[#1e1e1e] fm text-[10px]">
                    <thead>
                      <tr className="border-b border-[#1e1e1e]">
                        {Object.keys(msg.result[0]).map((c) => (
                          <th
                            key={c}
                            className="px-2 py-1 text-left text-[#5a5a5a] font-normal"
                          >
                            {c}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {msg.result.map((row, i) => (
                        <tr key={i} className="border-b border-[#0a0a0a]">
                          {Object.values(row).map((v, j) => (
                            <td key={j} className="px-2 py-1 text-[#5a5a5a]">
                              {String(v)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {!msg.isUser && msg.insights?.length ? (
                <div className="mt-2 space-y-0.5 border-t border-[#1e1e1e] pt-2">
                  {msg.insights.map((ins, i) => (
                    <p key={i} className="fm text-[9px] text-[#e8ff47]">
                      ▸ {ins}
                    </p>
                  ))}
                </div>
              ) : null}

              {!msg.isUser && msg.sql && (
                <details className="mt-2">
                  <summary className="fm text-[9px] text-[#3a3a3a] cursor-pointer">
                    // SQL
                  </summary>
                  <pre className="bg-black border border-[#1e1e1e] text-[#e8ff47] fm text-[9px] p-2 mt-1 overflow-x-auto">
                    {msg.sql}
                  </pre>
                </details>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-[#0d0d0d] border border-[#1e1e1e] px-4 py-3">
              <div className="flex gap-1">
                {[0, 150, 300].map((d) => (
                  <div
                    key={d}
                    className="w-1.5 h-1.5 rounded-full animate-bounce"
                    style={{ background: "#e8ff47", animationDelay: `${d}ms` }}
                  />
                ))}
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-3 pb-3 pt-2 border-t border-[#1e1e1e] shrink-0">
        <div className="flex gap-1.5 items-center">
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !loading && ask(question)}
            placeholder="اردو یا English..."
            dir="auto"
            className="flex-1 bg-[#0d0d0d] border border-[#1e1e1e] text-white px-3 py-2.5 text-sm focus:outline-none focus:border-[#e8ff47] transition-colors"
          />
          <button
            onClick={handleMic}
            className={`p-2.5 border transition-colors ${recording ? "text-black animate-pulse" : "border-[#1e1e1e] text-[#5a5a5a] hover:border-[#e8ff47]"}`}
            style={
              recording ? { background: "#e8ff47", borderColor: "#e8ff47" } : {}
            }
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              {recording ? (
                <rect x="6" y="6" width="12" height="12" rx="1" />
              ) : (
                <>
                  <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2H3v2a9 9 0 0 0 8 8.94V22h-3v2h8v-2h-3v-1.06A9 9 0 0 0 21 12v-2h-2z" />
                </>
              )}
            </svg>
          </button>
          <button
            onClick={() => ask(question)}
            disabled={loading || !question.trim()}
            className="fd text-base tracking-wide px-4 py-2.5 text-black disabled:opacity-40 transition"
            style={{ background: "#e8ff47" }}
          >
            ASK
          </button>
        </div>
      </div>
    </div>
  );
}

export default function WidgetPage() {
  return (
    <Suspense
      fallback={
        <div className="h-screen flex items-center justify-center bg-black">
          <div className="fd text-2xl text-[#e8ff47]">LOADING...</div>
        </div>
      }
    >
      <WidgetChat />
    </Suspense>
  );
}
