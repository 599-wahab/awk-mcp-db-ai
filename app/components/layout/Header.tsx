"use client";

import { useEffect, useState } from "react";

export default function Header() {
  const [status, setStatus] = useState({
    database: false,
    ai: false,
  });

  useEffect(() => {
    fetch("/api/health")
      .then(res => res.json())
      .then(setStatus)
      .catch(() => {});
  }, []);

  return (
    <header className="border-b bg-white p-4 flex justify-between">
      <h1 className="font-bold text-lg">AWKT-LD Database AI</h1>

      <div className="flex gap-4 text-sm">
        <span
          className={`px-3 py-1 rounded-full ${
            status.database
              ? "bg-green-100 text-green-700"
              : "bg-red-100 text-red-700"
          }`}
        >
          DB {status.database ? "Connected" : "Disconnected"}
        </span>

        <span
          className={`px-3 py-1 rounded-full ${
            status.ai
              ? "bg-green-100 text-green-700"
              : "bg-red-100 text-red-700"
          }`}
        >
          AI {status.ai ? "Connected" : "Disconnected"}
        </span>
      </div>
    </header>
  );
}
