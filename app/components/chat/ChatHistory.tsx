"use client";

import { useState, useEffect } from "react";

// Extend ChatLog to include result, feedback (needed for restore)
export interface ChatLog {
  id: string;
  question: string;
  explanation: string | null;
  generatedSql: string | null;
  result: any;               // JSON result from the query
  feedback: string | null;   // 'like' | 'dislike' | null
  wasSuccessful: boolean;
  detectedLang: string | null;
  createdAt: string;
}

interface Props {
  appId?: string;
  onSelectLog?: (log: ChatLog) => void;   // callback when a log is clicked
}

export default function ChatHistory({ appId, onSelectLog }: Props) {
  const [logs, setLogs] = useState<ChatLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    fetchHistory();
  }, [appId, page]);

  async function fetchHistory() {
    setLoading(true);
    const params = new URLSearchParams({
      page: String(page),
      limit: "20",
      ...(appId ? { appId } : {}),
    });
    const res = await fetch(`/api/chat-history?${params}`);
    const data = await res.json();
    setLogs(Array.isArray(data) ? data : []);
    setLoading(false);
  }

  if (loading) {
    return (
      <div className="text-center py-8 text-[#5a5a5a] fm text-xs">
        // Loading history...
      </div>
    );
  }

  if (!logs.length) {
    return (
      <div className="text-center py-8 border border-dashed border-[#1e1e1e]">
        <p className="fd text-2xl text-[#1e1e1e]">NO HISTORY YET</p>
        <p className="fm text-xs text-[#3a3a3a] mt-1">
          // Ask the bot a question to see history here
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2" style={{ fontFamily: "'DM Sans',sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Space+Mono:wght@400;700&family=DM+Sans:wght@300;400;500;600&display=swap');.fd{font-family:'Bebas Neue',sans-serif;}.fm{font-family:'Space Mono',monospace;}`}</style>

      {logs.map((log) => (
        <div
          key={log.id}
          className="border border-[#1e1e1e] bg-[#0d0d0d] hover:border-[#2a2a2a] transition-colors"
        >
          <div
            className="flex items-start justify-between gap-4 p-4 cursor-pointer"
            onClick={() => {
              if (onSelectLog) onSelectLog(log);
              else setExpandedId(expandedId === log.id ? null : log.id);
            }}
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span
                  className={`fm text-[9px] px-1.5 py-0.5 ${
                    log.wasSuccessful
                      ? "bg-[#e8ff47]/10 text-[#e8ff47]"
                      : "bg-red-500/10 text-red-400"
                  }`}
                >
                  {log.wasSuccessful ? "OK" : "FAIL"}
                </span>
                {log.detectedLang && (
                  <span className="fm text-[9px] bg-[#1e1e1e] text-[#5a5a5a] px-1.5 py-0.5 uppercase">
                    {log.detectedLang}
                  </span>
                )}
                <span className="fm text-[9px] text-[#3a3a3a]">
                  {new Date(log.createdAt).toLocaleString()}
                </span>
              </div>
              {/* User question — shown as user bubble */}
              <div className="flex justify-end mb-2">
                <div className="max-w-[80%] bg-[#e8ff47] text-black px-3 py-2 text-sm rounded-none">
                  <p dir="auto">{log.question}</p>
                </div>
              </div>
              {/* Bot answer — shown as bot bubble */}
              {log.explanation && (
                <div className="flex justify-start">
                  <div className="max-w-[80%] bg-[#1a1a1a] border border-[#2a2a2a] text-white px-3 py-2 text-sm">
                    <p dir="auto">{log.explanation}</p>
                  </div>
                </div>
              )}
            </div>
            <div className="fm text-[10px] text-[#3a3a3a] shrink-0">
              {expandedId === log.id ? "▲" : "▼"}
            </div>
          </div>

          {/* Expanded: show SQL */}
          {expandedId === log.id && log.generatedSql && (
            <div className="border-t border-[#1e1e1e] px-4 pb-4 pt-3">
              <p className="fm text-[10px] text-[#3a3a3a] mb-2">// Generated SQL</p>
              <pre className="bg-black border border-[#1e1e1e] text-[#e8ff47] fm text-[10px] p-3 overflow-x-auto whitespace-pre-wrap">
                {log.generatedSql}
              </pre>
            </div>
          )}
        </div>
      ))}

      {/* Pagination */}
      <div className="flex items-center justify-between pt-4">
        <button
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          disabled={page === 1}
          className="fm text-xs border border-[#1e1e1e] text-[#5a5a5a] px-4 py-2 hover:border-[#e8ff47] hover:text-[#e8ff47] disabled:opacity-30 transition-colors"
        >
          ← Prev
        </button>
        <span className="fm text-xs text-[#3a3a3a]">Page {page}</span>
        <button
          onClick={() => setPage((p) => p + 1)}
          disabled={logs.length < 20}
          className="fm text-xs border border-[#1e1e1e] text-[#5a5a5a] px-4 py-2 hover:border-[#e8ff47] hover:text-[#e8ff47] disabled:opacity-30 transition-colors"
        >
          Next →
        </button>
      </div>
    </div>
  );
}