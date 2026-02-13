"use client";

import { useState } from "react";
import Charts from "../charts/Charts";

interface Props {
  message: {
    content: string;
    isUser: boolean;
    timestamp: Date;
    sql?: string;
    result?: any[];
    visualization?: string;
    insights?: string[];
  };
  onDrillDown?: (value: string) => void;
}

export default function MessageBubble({ message }: Props) {
  const time = new Date(message.timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  const isAI = !message.isUser;

  const [viewType, setViewType] = useState(
    message.visualization || "line"
  );

  return (
    <div className={`flex ${isAI ? "justify-start" : "justify-end"}`}>
      <div
        className={`max-w-[90%] rounded-2xl px-4 py-3 ${
          isAI
            ? "bg-gray-50 border border-gray-200"
            : "bg-indigo-600 text-white"
        }`}
      >
        <div className="text-xs opacity-60 mb-1">
          {isAI ? "AWKT-LD" : "You"} • {time}
        </div>

        <p className="mb-2 whitespace-pre-wrap">{message.content}</p>

        {/* KPI */}
        {isAI &&
          message.visualization === "kpi" &&
          message.result?.length === 1 && (
            <div className="text-3xl font-bold text-indigo-600">
              {Object.values(message.result[0])[0]?.toLocaleString()}
            </div>
          )}

        {/* Chart Controls */}
        {isAI &&
          message.result &&
          message.visualization !== "kpi" &&
          message.visualization !== "table" && (
            <>
              <div className="flex gap-2 mb-3">
                <button
                  onClick={() => setViewType("line")}
                  className="px-3 py-1 text-xs bg-gray-200 rounded"
                >
                  Line
                </button>
                <button
                  onClick={() => setViewType("bar")}
                  className="px-3 py-1 text-xs bg-gray-200 rounded"
                >
                  Bar
                </button>
                <button
                  onClick={() => setViewType("stacked")}
                  className="px-3 py-1 text-xs bg-gray-200 rounded"
                >
                  Stacked
                </button>
                <button
                  onClick={() => setViewType("pie")}
                  className="px-3 py-1 text-xs bg-gray-200 rounded"
                >
                  Pie
                </button>
              </div>

              <Charts data={message.result} type={viewType} />
            </>
          )}

        {/* Table fallback */}
        {isAI &&
          message.visualization === "table" &&
          message.result && (
            <div className="overflow-x-auto mt-3 text-sm">
              <table className="min-w-full border">
                <thead>
                  <tr>
                    {Object.keys(message.result[0]).map((col) => (
                      <th key={col} className="border px-2 py-1">
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {message.result.map((row, i) => (
                    <tr key={i}>
                      {Object.values(row).map((val, j) => (
                        <td key={j} className="border px-2 py-1">
                          {String(val)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

        {/* Insights */}
        {message.insights?.length ? (
          <div className="mt-3 space-y-1 text-sm text-indigo-700">
            {message.insights.map((i, idx) => (
              <div key={idx}>📌 {i}</div>
            ))}
          </div>
        ) : null}

        {/* SQL */}
        {isAI && message.sql && (
          <details className="mt-3 text-xs">
            <summary className="cursor-pointer text-gray-500">
              View SQL
            </summary>
            <pre className="bg-black/10 p-2 rounded mt-2">
              {message.sql}
            </pre>
          </details>
        )}
      </div>
    </div>
  );
}
