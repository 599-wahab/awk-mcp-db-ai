"use client";
// app/login/page.tsx
// AWK TLD BOT — Sign In
// Uses useRouter for dynamic redirect (no hardcoded port/URL)

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [lang, setLang] = useState<"en" | "ur">("en");
  const router = useRouter();

  const t = lang === "ur"
    ? { heading: "واپس خوش آمدید", sub: "اپنے اکاؤنٹ میں داخل ہوں", email: "ای میل", pass: "پاس ورڈ", btn: "داخل ہوں", err: "ای میل یا پاس ورڈ غلط ہے", loading: "لاگ ان ہو رہا ہے...", noAcc: "اکاؤنٹ نہیں ہے؟", register: "رجسٹر کریں" }
    : { heading: "Welcome Back", sub: "Sign in to your account", email: "Email address", pass: "Password", btn: "Sign In", err: "Invalid email or password", loading: "Signing in...", noAcc: "No account?", register: "Register free" };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    if (result?.error) {
      setError(t.err);
      setLoading(false);
    } else {
      // router.push keeps the same origin/port — never hardcoded
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
        input:-webkit-autofill{-webkit-box-shadow:0 0 0 100px #0d0d0d inset!important;-webkit-text-fill-color:#fff!important;border-color:#1e1e1e!important;}
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
          {/* Card */}
          <div className="border border-[#1e1e1e] bg-[#0d0d0d] p-8">
            {/* Header */}
            <div className="mb-8">
              <div className="fd text-5xl tracking-wider mb-1" style={{ color: "#e8ff47" }}>{t.heading}</div>
              <p className="fm text-xs text-[#5a5a5a] uppercase tracking-wider">{t.sub}</p>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="fm block text-[10px] text-[#5a5a5a] uppercase tracking-wider mb-1.5">{t.email}</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  className="w-full bg-black border border-[#1e1e1e] text-white px-4 py-3 text-sm focus:outline-none focus:border-[#e8ff47] transition-colors"
                  placeholder="you@company.com"
                  dir="ltr"
                />
              </div>

              <div>
                <label className="fm block text-[10px] text-[#5a5a5a] uppercase tracking-wider mb-1.5">{t.pass}</label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  className="w-full bg-black border border-[#1e1e1e] text-white px-4 py-3 text-sm focus:outline-none focus:border-[#e8ff47] transition-colors"
                  placeholder="••••••••"
                  dir="ltr"
                />
              </div>

              {error && (
                <div className="border border-red-500/30 bg-red-500/10 px-4 py-2.5">
                  <p className="fm text-xs text-red-400">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 font-bold text-black text-sm transition hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ background: "#e8ff47" }}>
                {loading ? t.loading : t.btn}
              </button>
            </form>

            {/* Footer */}
            <div className="mt-6 pt-6 border-t border-[#1e1e1e] flex items-center justify-between">
              <p className="fm text-xs text-[#5a5a5a]">{t.noAcc}</p>
              <Link href="/register" className="fm text-xs hover:underline transition-colors" style={{ color: "#e8ff47" }}>
                {t.register} →
              </Link>
            </div>
          </div>

          <p className="fm text-xs text-center text-[#2a2a2a] mt-4">// AWK TLD BOT — AI Database Assistant</p>
        </div>
      </div>
    </div>
  );
}