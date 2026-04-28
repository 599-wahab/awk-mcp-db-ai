"use client";
import { useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function ConnectDatabasePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [dbUrl, setDbUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [error, setError] = useState("");

  if (status === "loading") return <div className="p-6">Loading...</div>;
  if (!session) {
    router.push("/login");
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setApiKey("");

    const res = await fetch("/api/connect-db", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ databaseUrl: dbUrl }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Failed to connect database");
    } else {
      setApiKey(data.apiKey);
    }
    setLoading(false);
  };

  return (
    <div className="max-w-xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Connect Your ERP Database</h1>
      <p className="text-gray-600 mb-6">
        Provide the connection string for your PostgreSQL database. The bot will introspect your schema and allow you to query it via AI.
      </p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Database URL</label>
          <input
            type="text"
            value={dbUrl}
            onChange={(e) => setDbUrl(e.target.value)}
            placeholder="postgresql://user:pass@host:5432/dbname"
            required
            className="w-full border rounded-md px-3 py-2"
          />
          <p className="text-xs text-gray-500 mt-1">
            Use a <strong>read-only</strong> user for security.
          </p>
        </div>
        <button
          type="submit"
          disabled={loading}
          className="bg-blue-600 text-white px-4 py-2 rounded-md disabled:opacity-50"
        >
          {loading ? "Connecting..." : "Connect Database"}
        </button>
      </form>

      {error && (
        <div className="mt-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
          {error}
        </div>
      )}

      {apiKey && (
        <div className="mt-6 p-4 bg-green-100 border border-green-400 rounded">
          <h2 className="font-bold">Database connected successfully!</h2>
          <p className="text-sm mt-2">Your API key:</p>
          <pre className="bg-gray-800 text-white p-2 rounded text-sm overflow-x-auto">{apiKey}</pre>
          <p className="text-sm mt-2">
            Use this API key in your ERP widget. Store it securely.
          </p>
        </div>
      )}
    </div>
  );
}