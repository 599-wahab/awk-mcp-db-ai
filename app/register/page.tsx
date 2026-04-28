"use client";
// app/register/page.tsx
import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function RegisterPage() {
  const [form, setForm] = useState({ name: "", email: "", password: "", confirm: "", databaseUrl: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [lang, setLang] = useState<"en" | "ur">("en");
  const router = useRouter();

  const t = lang === "ur"
    ? { heading: "اکاؤنٹ بنائیں", sub: "مفت میں شروع کریں", name: "آپ کا نام", email: "ای میل", pass: "پاس ورڈ", confirm: "پاس ورڈ دوبارہ", dbUrl: "ڈیٹا بیس یو آر ایل (اختیاری)", btn: "اکاؤنٹ بنائیں", loading: "بن رہا ہے...", haveAcc: "پہلے سے اکاؤنٹ ہے؟", login: "لاگ ان کریں" }
    : { heading: "Create Account", sub: "Start for free — no credit card", name: "Full name", email: "Email address", pass: "Password", confirm: "Confirm password", dbUrl: "Database URL (optional)", btn: "Create Account", loading: "Creating...", haveAcc: "Already have an account?", login: "Sign in" };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (form.password !== form.confirm) {
      setError(lang === "ur" ? "پاس ورڈ میچ نہیں ہوئے" : "Passwords do not match");
      return;
    }
    if (form.password.length < 6) {
      setError(lang === "ur" ? "پاس ورڈ کم از کم 6 حروف کا ہونا چاہیے" : "Password must be at least 6 characters");
      return;
    }

    setLoading(true);

    const res = await fetch("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        email: form.email,
        password: form.password,
        databaseUrl: form.databaseUrl || undefined,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      setError(data.error || "Registration failed");
      setLoading(false);
      return;
    }

    // If API key was returned, store it in localStorage for convenience
    if (data.apiKey) {
      localStorage.setItem("bot_api_key", data.apiKey);
    }

    // Auto-login after register
    const result = await signIn("credentials", {
      email: form.email,
      password: form.password,
      redirect: false,
    });

    if (result?.error) {
      setError("Account created but login failed. Please sign in manually.");
      setLoading(false);
    } else {
      router.push("/dashboard");
    }
  }

  return (
    <div className="min-h-screen bg-black text-white flex flex-col" style={{ fontFamily: "'DM Sans',sans-serif" }}
      dir={lang === "ur" ? "rtl" : "ltr"}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Space+Mono:wght@400;700&family=DM+Sans:wght@300;400;500;600&display=swap');
        .fd{font-family:'Bebas Neue',sans-serif;}
        .fm{font-family:'Space Mono',monospace;}
        @keyframes fu{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
        .fu{animation:fu .5s ease both;}
        .grid-bg{background-image:linear-gradient(rgba(232,255,71,.03) 1px,transparent 1px),linear-gradient(90deg,rgba(232,255,71,.03) 1px,transparent 1px);background-size:50px 50px;}
        input:-webkit-autofill{-webkit-box-shadow:0 0 0 100px #000 inset!important;-webkit-text-fill-color:#fff!important;border-color:#1e1e1e!important;}
      `}</style>

      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-[#1e1e1e]">
        <Link href="/" className="fd text-2xl tracking-wider">
          AWK<span style={{ color: "#e8ff47" }}> TLD</span>
          <span className="fm text-xs border border-[#e8ff47] ml-2 px-2 py-0.5 align-middle" style={{ color: "#e8ff47" }}>BOT</span>
        </Link>
        <button onClick={() => setLang(l => l === "en" ? "ur" : "en")}
          className="fm text-xs border border-[#1e1e1e] text-[#5a5a5a] px-3 py-1.5 hover:border-[#e8ff47] hover:text-[#e8ff47] transition-colors">
          {lang === "en" ? "اردو" : "English"}
        </button>
      </div>

      {/* Main */}
      <div className="flex-1 grid-bg flex items-center justify-center px-4 py-16">
        <div className="w-full max-w-md fu">
          <div className="border border-[#1e1e1e] bg-[#0d0d0d] p-8">
            <div className="mb-8">
              <div className="fd text-5xl tracking-wider mb-1" style={{ color: "#e8ff47" }}>{t.heading}</div>
              <p className="fm text-xs text-[#5a5a5a] uppercase tracking-wider">{t.sub}</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="fm block text-[10px] text-[#5a5a5a] uppercase tracking-wider mb-1.5">{t.name}</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  required
                  className="w-full bg-black border border-[#1e1e1e] text-white px-4 py-3 text-sm focus:outline-none focus:border-[#e8ff47] transition-colors"
                  placeholder="Muhammad Ali"
                  dir="auto"
                />
              </div>

              <div>
                <label className="fm block text-[10px] text-[#5a5a5a] uppercase tracking-wider mb-1.5">{t.email}</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  required
                  className="w-full bg-black border border-[#1e1e1e] text-white px-4 py-3 text-sm focus:outline-none focus:border-[#e8ff47] transition-colors"
                  placeholder="you@company.com"
                  dir="ltr"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="fm block text-[10px] text-[#5a5a5a] uppercase tracking-wider mb-1.5">{t.pass}</label>
                  <input
                    type="password"
                    value={form.password}
                    onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                    required
                    className="w-full bg-black border border-[#1e1e1e] text-white px-4 py-3 text-sm focus:outline-none focus:border-[#e8ff47] transition-colors"
                    placeholder="••••••"
                    dir="ltr"
                  />
                </div>
                <div>
                  <label className="fm block text-[10px] text-[#5a5a5a] uppercase tracking-wider mb-1.5">{t.confirm}</label>
                  <input
                    type="password"
                    value={form.confirm}
                    onChange={e => setForm(f => ({ ...f, confirm: e.target.value }))}
                    required
                    className="w-full bg-black border border-[#1e1e1e] text-white px-4 py-3 text-sm focus:outline-none focus:border-[#e8ff47] transition-colors"
                    placeholder="••••••"
                    dir="ltr"
                  />
                </div>
              </div>

              <div>
                <label className="fm block text-[10px] text-[#5a5a5a] uppercase tracking-wider mb-1.5">{t.dbUrl}</label>
                <input
                  type="text"
                  value={form.databaseUrl}
                  onChange={e => setForm(f => ({ ...f, databaseUrl: e.target.value }))}
                  className="w-full bg-black border border-[#1e1e1e] text-white px-4 py-3 text-sm focus:outline-none focus:border-[#e8ff47] transition-colors"
                  placeholder="postgresql://user:pass@host:5432/your_erp"
                  dir="ltr"
                />
                <p className="text-[10px] text-[#5a5a5a] mt-1">
                  Leave empty to connect later from dashboard
                </p>
              </div>

              {error && (
                <div className="border border-red-500/30 bg-red-500/10 px-4 py-2.5">
                  <p className="fm text-xs text-red-400">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 font-bold text-black text-sm transition hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed mt-2"
                style={{ background: "#e8ff47" }}>
                {loading ? t.loading : t.btn}
              </button>
            </form>

            <div className="mt-6 pt-6 border-t border-[#1e1e1e] flex items-center justify-between">
              <p className="fm text-xs text-[#5a5a5a]">{t.haveAcc}</p>
              <Link href="/login" className="fm text-xs hover:underline" style={{ color: "#e8ff47" }}>
                {t.login} →
              </Link>
            </div>
          </div>
          <p className="fm text-xs text-center text-[#2a2a2a] mt-4">// AWK TLD BOT — Free forever for the basics</p>
        </div>
      </div>
    </div>
  );
}