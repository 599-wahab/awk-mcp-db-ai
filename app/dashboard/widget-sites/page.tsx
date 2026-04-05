"use client";

// app/dashboard/widget-sites/page.tsx
// Manage connected Vercel apps — register, view snippet, delete

import { useState, useEffect } from "react";

interface Site {
  id: string;
  siteId: string;
  name: string;
  origin: string;
  createdAt: string;
}

export default function WidgetSitesPage() {
  const [sites, setSites] = useState<Site[]>([]);
  const [name, setName] = useState("");
  const [origin, setOrigin] = useState("https://");
  const [creating, setCreating] = useState(false);
  const [newSnippet, setNewSnippet] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch("/api/widget/register")
      .then((r) => r.json())
      .then(setSites);
  }, []);

  async function createSite() {
    setCreating(true);
    const res = await fetch("/api/widget/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, origin }),
    });
    const data = await res.json();
    setNewSnippet(data.snippet);
    setSites((s) => [
      { id: data.siteId, siteId: data.siteId, name, origin, createdAt: new Date().toISOString() },
      ...s,
    ]);
    setName("");
    setOrigin("https://");
    setCreating(false);
  }

  function copy(text: string) {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Connected Apps</h1>
        <p className="text-gray-500 text-sm mt-1">
          Register your other Vercel apps to embed the AWKT-LD chat widget.
        </p>
      </div>

      {/* Register form */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
        <h2 className="font-semibold text-gray-800">Register new app</h2>
        <div>
          <label className="block text-sm text-gray-600 mb-1">App name</label>
          <input
            className="w-full border rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Sales Portal"
          />
        </div>
        <div>
          <label className="block text-sm text-gray-600 mb-1">App URL (origin)</label>
          <input
            className="w-full border rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            value={origin}
            onChange={(e) => setOrigin(e.target.value)}
            placeholder="https://sales.vercel.app"
          />
        </div>
        <button
          onClick={createSite}
          disabled={creating || !name || !origin}
          className="bg-indigo-600 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
        >
          {creating ? "Registering..." : "Register app"}
        </button>

        {/* Show snippet after creation */}
        {newSnippet && (
          <div className="mt-4 bg-gray-900 rounded-lg p-4 relative">
            <p className="text-xs text-gray-400 mb-2">
              Paste this in your app's HTML (before &lt;/body&gt;):
            </p>
            <code className="text-green-400 text-xs break-all">{newSnippet}</code>
            <button
              onClick={() => copy(newSnippet)}
              className="absolute top-3 right-3 text-xs bg-white/10 hover:bg-white/20 text-white px-2 py-1 rounded"
            >
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
        )}
      </div>

      {/* Existing sites */}
      {sites.length > 0 && (
        <div className="space-y-3">
          <h2 className="font-semibold text-gray-800">Registered apps</h2>
          {sites.map((site) => (
            <div
              key={site.id}
              className="bg-white border border-gray-200 rounded-xl p-4 flex items-center justify-between"
            >
              <div>
                <p className="font-medium text-gray-900">{site.name}</p>
                <p className="text-xs text-gray-400 mt-0.5">{site.origin}</p>
                <p className="text-xs text-gray-300 mt-0.5 font-mono">{site.siteId}</p>
              </div>
              <button
                onClick={() =>
                  copy(
                    `<script src="${window.location.origin}/embed.js" data-site-id="${site.siteId}"></script>`
                  )
                }
                className="text-xs bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-lg hover:bg-indigo-100 transition-colors"
              >
                Copy snippet
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}