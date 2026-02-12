"use client";

import { useEffect, useState } from "react";

export default function SettingsPage() {
  const [databaseUrl, setDatabaseUrl] = useState("");
  const [geminiApiKey, setGeminiApiKey] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/settings")
      .then(res => res.json())
      .then(data => {
        setDatabaseUrl(data.databaseUrl || "");
        setGeminiApiKey(data.geminiApiKey || "");
      });
  }, []);

  async function handleSave() {
    await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ databaseUrl, geminiApiKey }),
    });

    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="p-10 max-w-2xl">
      <h1 className="text-2xl font-bold mb-6">Connection Settings</h1>

      <div className="space-y-6">

        <div>
          <label className="block text-sm font-medium mb-2">
            Database Connection String
          </label>
          <textarea
            className="w-full border rounded p-3"
            rows={3}
            value={databaseUrl}
            onChange={e => setDatabaseUrl(e.target.value)}
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">
            Gemini API Key
          </label>
          <input
            className="w-full border rounded p-3"
            value={geminiApiKey}
            onChange={e => setGeminiApiKey(e.target.value)}
          />
        </div>

        <button
          onClick={handleSave}
          className="px-6 py-2 bg-indigo-600 text-white rounded"
        >
          Save Settings
        </button>

        {saved && (
          <p className="text-green-600 text-sm">
            Settings saved successfully!
          </p>
        )}

      </div>
    </div>
  );
}
