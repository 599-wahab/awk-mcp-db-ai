"use client";
// app/widget/page.tsx - popup iframe loaded by embed.js
//bot code
import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Charts from "@/app/components/charts/Charts";

type ResultRow = Record<string, string | number | boolean | null>;

type BotAction =
  | { type: "navigate"; href: string; label?: string }
  | {
      type: "open_record";
      entity: "invoice" | "product" | "customer" | "staff" | "team" | "task";
      id: string;
      label?: string;
      href?: string;
      payload?: Record<string, unknown>;
    }
  | { type: "show_summary"; entity: string; payload: Record<string, unknown> }
  | { type: "clarify"; question: string; options?: string[] };

type Message = {
  id: string;
  content: string;
  isUser: boolean;
  timestamp: Date;
  sql?: string;
  result?: ResultRow[];
  visualization?: string;
  insights?: string[];
  actions?: BotAction[];
};

type SpeechRecognitionConstructor = new () => SpeechRecognition;

type SpeechRecognition = {
  lang: string;
  interimResults: boolean;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

type SpeechRecognitionEvent = {
  results: ArrayLike<ArrayLike<{ transcript: string }>>;
};

function WidgetChat() {
  const params = useSearchParams();
  const apiKey = params.get("key") || "";
  const tenantId = params.get("tenantId") || "";
  const companyId = params.get("companyId") || "";
  const userId = params.get("userId") || "";
  const userEmail = params.get("userEmail") || "";
  const widgetMode = params.get("widgetMode") || "general";
  const currentPath = params.get("currentPath") || "";
  const parentOrigin = params.get("parentOrigin") || "*";

  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
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

  function startVoice(onResult: (text: string) => void, onEnd: () => void) {
    const recognitionWindow = window as Window & {
      SpeechRecognition?: SpeechRecognitionConstructor;
      webkitSpeechRecognition?: SpeechRecognitionConstructor;
    };
    const SpeechRecognitionApi =
      recognitionWindow.SpeechRecognition ||
      recognitionWindow.webkitSpeechRecognition;

    if (!SpeechRecognitionApi) {
      onEnd();
      return () => {};
    }

    const recognizer = new SpeechRecognitionApi();
    recognizer.lang = "ur-PK";
    recognizer.interimResults = false;
    recognizer.onresult = (event) => onResult(event.results[0][0].transcript);
    recognizer.onerror = () => onEnd();
    recognizer.onend = () => onEnd();
    recognizer.start();

    return () => {
      try {
        recognizer.stop();
      } catch {
        // Browser speech APIs can throw if stop is called after the session ended.
      }
    };
  }

  function speakText(text: string) {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    const voice = window.speechSynthesis
      .getVoices()
      .find((candidate) => candidate.lang.startsWith("ur"));
    if (voice) utterance.voice = voice;
    utterance.rate = 0.9;
    window.speechSynthesis.speak(utterance);
  }

  async function ask(text: string) {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    const chatHistory = messages.slice(-6).map((message) => ({
      content: message.content,
      isUser: message.isUser,
      sql: message.sql,
      result: message.result,
      actions: message.actions,
    }));

    setMessages((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        content: trimmed,
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

      const response = await fetch("/api/ai", {
        method: "POST",
        headers,
        body: JSON.stringify({
          question: trimmed,
          tenant_id: tenantId || undefined,
          company_id: companyId || undefined,
          userId: userId || undefined,
          userEmail: userEmail || undefined,
          widgetMode,
          currentPath: currentPath || undefined,
          chatHistory,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || "Request failed.");
      }

      const assistantText =
        data.response || data.explanation || data.message || data.error || "Error occurred.";
      const actions = Array.isArray(data.actions)
        ? data.actions
        : data.action
          ? [data.action]
          : [];

      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          content: assistantText,
          isUser: false,
          timestamp: new Date(),
          sql: data.sql,
          result: data.result,
          visualization: data.visualization,
          insights: data.insights,
          actions,
        },
      ]);

      if (ttsOn && assistantText) speakText(assistantText);
    } catch (error) {
      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          content:
            error instanceof Error
              ? error.message
              : "Connection error. Please try again.",
          isUser: false,
          timestamp: new Date(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function handleMic() {
    if (recording) {
      stopRef.current?.();
      setRecording(false);
      return;
    }

    setRecording(true);
    stopRef.current = startVoice(
      (text) => {
        setRecording(false);
        ask(text);
      },
      () => setRecording(false),
    );
  }

  function getViz(id: string, fallback: string) {
    return viewTypes[id] ?? fallback ?? "line";
  }

  function triggerAction(action: BotAction) {
    if (window.parent && window.parent !== window) {
      window.parent.postMessage(
        {
          type: "AWKTLD_WIDGET_ACTION",
          action,
        },
        parentOrigin,
      );
    }

    if (action.type === "navigate" && action.href) {
      window.open(action.href, "_blank", "noopener,noreferrer");
    }
  }

  return (
    <div
      className="h-screen flex flex-col bg-black text-white overflow-hidden"
      style={{ fontFamily: "'DM Sans', sans-serif" }}
    >
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Space+Mono:wght@400;700&family=DM+Sans:wght@300;400;500;600&display=swap');.fd{font-family:'Bebas Neue',sans-serif;}.fm{font-family:'Space Mono',monospace;}`}</style>

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
          type="button"
          onClick={() => setTtsOn((value) => !value)}
          className="fm text-[10px] bg-black/10 text-black px-2 py-1 hover:bg-black/20 transition-colors"
        >
          {ttsOn ? "Voice on" : "Voice off"}
        </button>
        <div className="w-2 h-2 bg-black/30 rounded-full" />
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.isUser ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[90%] px-3 py-2.5 ${
                message.isUser
                  ? "text-black"
                  : "bg-[#0d0d0d] border border-[#1e1e1e] text-white"
              }`}
              style={
                message.isUser
                  ? { background: "#e8ff47", borderRadius: 0 }
                  : { borderRadius: 0 }
              }
            >
              <p
                className={`fm text-[9px] mb-1 ${
                  message.isUser ? "text-black/50" : "text-[#3a3a3a]"
                }`}
              >
                {message.isUser ? "YOU" : "BOT"} •{" "}
                {new Date(message.timestamp).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
              <p className="text-sm whitespace-pre-wrap leading-relaxed" dir="auto">
                {message.content}
              </p>

              {!message.isUser &&
                message.visualization === "kpi" &&
                message.result?.length === 1 && (
                  <div
                    className="fd text-3xl mt-2"
                    style={{ color: "#e8ff47" }}
                  >
                    {String(Object.values(message.result[0])[0])}
                  </div>
                )}

              {!message.isUser &&
                message.result?.length &&
                message.visualization &&
                !["kpi", "table", "none"].includes(message.visualization) && (
                  <div className="mt-3">
                    <div className="flex gap-1 mb-2 flex-wrap">
                      {["line", "bar", "stacked", "pie"].map((type) => (
                        <button
                          type="button"
                          key={type}
                          onClick={() =>
                            setViewTypes((current) => ({
                              ...current,
                              [message.id]: type,
                            }))
                          }
                          className={`fm text-[9px] px-2 py-0.5 border transition-colors ${
                            getViz(message.id, message.visualization!) === type
                              ? "border-[#e8ff47] text-[#e8ff47]"
                              : "border-[#1e1e1e] text-[#5a5a5a]"
                          }`}
                        >
                          {type.toUpperCase()}
                        </button>
                      ))}
                    </div>
                    <Charts
                      data={message.result}
                      type={getViz(message.id, message.visualization)}
                    />
                  </div>
                )}

              {!message.isUser &&
              message.visualization === "table" &&
              message.result?.length ? (
                <div className="overflow-x-auto mt-2">
                  <table className="min-w-full border border-[#1e1e1e] fm text-[10px]">
                    <thead>
                      <tr className="border-b border-[#1e1e1e]">
                        {Object.keys(message.result[0]).map((column) => (
                          <th
                            key={column}
                            className="px-2 py-1 text-left text-[#5a5a5a] font-normal"
                          >
                            {column}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {message.result.map((row, rowIndex) => (
                        <tr key={rowIndex} className="border-b border-[#0a0a0a]">
                          {Object.values(row).map((value, valueIndex) => (
                            <td
                              key={valueIndex}
                              className="px-2 py-1 text-[#5a5a5a]"
                            >
                              {String(value)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}

              {!message.isUser && message.insights?.length ? (
                <div className="mt-2 space-y-0.5 border-t border-[#1e1e1e] pt-2">
                  {message.insights.map((insight, index) => (
                    <p key={index} className="fm text-[9px] text-[#e8ff47]">
                      &gt; {insight}
                    </p>
                  ))}
                </div>
              ) : null}

              {!message.isUser && message.actions?.length ? (
                <div className="mt-3 flex flex-wrap gap-2 border-t border-[#1e1e1e] pt-3">
                  {message.actions.map((action, index) => (
                    <button
                      type="button"
                      key={`${message.id}-action-${index}`}
                      onClick={() => triggerAction(action)}
                      className="fm text-[10px] px-3 py-1.5 border border-[#e8ff47] text-[#e8ff47] hover:bg-[#e8ff47] hover:text-black transition-colors"
                    >
                      {action.type === "clarify"
                        ? "Choose record"
                        : "label" in action && action.label
                          ? action.label
                          : action.type.replace("_", " ").toUpperCase()}
                    </button>
                  ))}
                </div>
              ) : null}

              {!message.isUser && message.sql && (
                <details className="mt-2">
                  <summary className="fm text-[9px] text-[#3a3a3a] cursor-pointer">
                    SQL
                  </summary>
                  <pre className="bg-black border border-[#1e1e1e] text-[#e8ff47] fm text-[9px] p-2 mt-1 overflow-x-auto">
                    {message.sql}
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
                {[0, 150, 300].map((delay) => (
                  <div
                    key={delay}
                    className="w-1.5 h-1.5 rounded-full animate-bounce"
                    style={{
                      background: "#e8ff47",
                      animationDelay: `${delay}ms`,
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="px-3 pb-3 pt-2 border-t border-[#1e1e1e] shrink-0">
        <div className="flex gap-1.5 items-center">
          <input
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            onKeyDown={(event) =>
              event.key === "Enter" && !loading && ask(question)
            }
            placeholder="اردو یا English..."
            dir="auto"
            className="flex-1 bg-[#0d0d0d] border border-[#1e1e1e] text-white px-3 py-2.5 text-sm focus:outline-none focus:border-[#e8ff47] transition-colors"
          />
          <button
            type="button"
            onClick={handleMic}
            className={`p-2.5 border transition-colors ${
              recording
                ? "text-black animate-pulse"
                : "border-[#1e1e1e] text-[#5a5a5a] hover:border-[#e8ff47]"
            }`}
            style={
              recording ? { background: "#e8ff47", borderColor: "#e8ff47" } : {}
            }
            aria-label={recording ? "Stop recording" : "Start voice input"}
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
            type="button"
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
