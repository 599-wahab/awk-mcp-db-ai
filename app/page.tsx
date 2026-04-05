"use client";
// app/page.tsx — AWK TLD BOT Landing Page
// Matches AWK TLD ERP/RMS: black background, #e8ff47 lime accent, Bebas Neue + Space Mono

import Link from "next/link";
import { useState } from "react";

const FEATURES = [
  { icon: "🗄️", title: "Reads Your Database", desc: "Connect any PostgreSQL database. AI auto-learns your schema and generates perfect SQL instantly.", tag: "AUTO SCHEMA" },
  { icon: "🎙️", title: "Urdu + English Voice", desc: "Press mic, speak Urdu or English. Answers come back in your language — no keyboard needed.", tag: "BILINGUAL AI" },
  { icon: "📊", title: "Live Charts & KPIs", desc: "Bar, line, pie, stacked — results render as interactive charts. Switch chart type with one click.", tag: "VISUALIZE" },
  { icon: "🔌", title: "One Script Tag", desc: "Paste one line in your ERP. A floating chat button appears on every page. Zero rebuild.", tag: "EMBED READY" },
  { icon: "🧠", title: "Auto Memory", desc: "First query builds a full memory of your DB structure. Every answer gets smarter automatically.", tag: "SMART MEMORY" },
  { icon: "🔒", title: "Isolated Per App", desc: "Each connected app gets its own API key. Queries only touch that app's database. Fully secure.", tag: "SECURE" },
];

const STEPS = [
  { num: "01", title: "Register & Login", desc: "Create your AWKT-LD account. 30 seconds." },
  { num: "02", title: "Add Your App", desc: "Connected Apps → New App. Enter app name + its database URL." },
  { num: "03", title: "Copy the Snippet", desc: "One line of code. Paste before </body> in your app." },
  { num: "04", title: "Chat with Your Data", desc: "A floating button appears. Click it. Ask in Urdu or English. Instant results." },
];

const COMPATIBLE = [
  "AWK TLD ERP", "AWK TLD RMS", "Next.js Apps", "Laravel Apps",
  "Any PostgreSQL DB", "Any MySQL DB", "Supabase Projects", "Neon Databases",
];

export default function LandingPage() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-black text-white overflow-x-hidden" style={{ fontFamily: "'DM Sans',sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Space+Mono:wght@400;700&family=DM+Sans:wght@300;400;500;600&display=swap');
        :root{--a:#e8ff47;--b:#1e1e1e;--d:#5a5a5a;--s:#0d0d0d;}
        .fd{font-family:'Bebas Neue',sans-serif;}
        .fm{font-family:'Space Mono',monospace;}
        @keyframes tick{from{transform:translateX(0)}to{transform:translateX(-50%)}}
        @keyframes fu{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
        @keyframes pl{0%,100%{box-shadow:0 0 0 0 rgba(232,255,71,.35)}50%{box-shadow:0 0 0 10px rgba(232,255,71,0)}}
        .fu1{animation:fu .7s ease both;}
        .fu2{animation:fu .7s .15s ease both;}
        .fu3{animation:fu .7s .3s ease both;}
        .grid-bg{background-image:linear-gradient(rgba(232,255,71,.025) 1px,transparent 1px),linear-gradient(90deg,rgba(232,255,71,.025) 1px,transparent 1px);background-size:55px 55px;}
        .card{transition:border-color .2s,transform .2s;}
        .card:hover{border-color:var(--a) !important;transform:translateY(-3px);}
      `}</style>

      {/* TOP TICKER */}
      <div className="bg-[#e8ff47] text-black py-2 overflow-hidden whitespace-nowrap">
        <div className="inline-block" style={{animation:"tick 22s linear infinite"}}>
          {["💬 AI DATABASE CHAT","🎙️ URDU + ENGLISH VOICE","📊 INSTANT CHARTS","🔌 ONE SCRIPT TAG","🧠 AUTO SCHEMA MEMORY","💬 AI DATABASE CHAT","🎙️ URDU + ENGLISH VOICE","📊 INSTANT CHARTS","🔌 ONE SCRIPT TAG","🧠 AUTO SCHEMA MEMORY"].map((t,i)=>(
            <span key={i} className="fm text-[11px] font-bold tracking-widest uppercase px-10">{t}</span>
          ))}
        </div>
      </div>

      {/* NAV */}
      <nav className="sticky top-0 z-50 bg-black/95 backdrop-blur border-b border-[#1e1e1e] px-6 md:px-12 py-4 flex items-center justify-between">
        <div className="fd text-2xl tracking-wider">
          AWK<span style={{color:"#e8ff47"}}> TLD</span>
          <span className="fm text-xs border border-[#e8ff47] ml-2 px-2 py-0.5 align-middle" style={{color:"#e8ff47"}}>BOT</span>
        </div>
        <ul className="hidden md:flex gap-8 list-none m-0 p-0">
          {[["#features","Features"],["#how","How It Works"],["#compatible","Compatible"]].map(([h,l])=>(
            <li key={h}><a href={h} className="fm text-xs text-[#5a5a5a] uppercase tracking-wider hover:text-[#e8ff47] transition-colors">{l}</a></li>
          ))}
        </ul>
        <div className="hidden md:flex gap-3">
          <Link href="/login" className="px-5 py-2 text-xs font-medium border border-[#1e1e1e] text-white hover:border-[#e8ff47] hover:text-[#e8ff47] transition-colors">Sign In</Link>
          <Link href="/register" className="px-5 py-2 text-xs font-bold text-black" style={{background:"#e8ff47",animation:"pl 2.5s infinite"}}>Get Started Free</Link>
        </div>
        <button className="md:hidden text-white text-lg" onClick={()=>setMenuOpen(!menuOpen)}>{menuOpen?"✕":"☰"}</button>
        {menuOpen&&(
          <div className="absolute top-16 left-0 right-0 bg-black border-b border-[#1e1e1e] p-6 flex flex-col gap-4">
            <Link href="/login" className="text-sm text-[#5a5a5a]" onClick={()=>setMenuOpen(false)}>Sign In</Link>
            <Link href="/register" className="text-sm font-bold" style={{color:"#e8ff47"}} onClick={()=>setMenuOpen(false)}>Get Started Free →</Link>
          </div>
        )}
      </nav>

      {/* HERO */}
      <section className="relative min-h-[90vh] flex items-center px-6 md:px-12 py-20 grid-bg overflow-hidden">
        <div className="absolute inset-0 pointer-events-none" style={{background:"radial-gradient(ellipse at 40% 50%,rgba(232,255,71,0.07) 0%,transparent 65%)"}}/>
        <div className="relative z-10 max-w-5xl">
          <div className="fm inline-flex items-center gap-2 border border-[#1e1e1e] px-4 py-2 text-xs text-[#5a5a5a] uppercase tracking-wider mb-8 fu1">
            <span className="w-1.5 h-1.5 rounded-full" style={{background:"#e8ff47",animation:"pl 2s infinite"}}/>
            AI-Powered Database Chat — Now Live
          </div>
          <h1 className="fd leading-none tracking-tighter mb-6 fu2" style={{fontSize:"clamp(60px,11vw,130px)"}}>
            CHAT WITH<br/>
            <span style={{color:"#e8ff47"}}>YOUR DATA.</span><br/>
            <span style={{WebkitTextStroke:"1px #fff",color:"transparent"}}>IN URDU.</span>
          </h1>
          <p className="text-lg text-[#5a5a5a] max-w-xl mb-10 font-light leading-relaxed fu3">
            AWKT-LD BOT connects to your ERP, reads your database,
            and answers questions in Urdu or English — with charts, SQL, and voice.
          </p>
          <div className="flex flex-wrap gap-4 items-center fu3">
            <Link href="/register" className="px-8 py-4 text-base font-bold text-black transition hover:-translate-y-1" style={{background:"#e8ff47"}}>
              Connect Your First App →
            </Link>
            <Link href="/login" className="px-8 py-4 text-base font-medium border border-[#1e1e1e] text-white hover:border-[#e8ff47] hover:text-[#e8ff47] transition-colors">
              Sign In
            </Link>
          </div>
          <p className="fm text-xs text-[#5a5a5a] mt-5 fu3">// Free to use &nbsp;|&nbsp; No credit card &nbsp;|&nbsp; Any PostgreSQL DB</p>
        </div>

        {/* Chat preview bubble */}
        <div className="absolute bottom-10 right-10 hidden xl:block fu3">
          <div className="w-72 bg-[#0d0d0d] border border-[#1e1e1e] rounded-2xl overflow-hidden shadow-2xl">
            <div className="bg-[#4f46e5] px-4 py-3 flex items-center gap-2">
              <div className="w-7 h-7 bg-white/20 rounded-lg flex items-center justify-center text-white text-xs font-bold">AW</div>
              <div><p className="text-white text-xs font-semibold">AWKT-LD BOT</p><p className="text-indigo-200 text-[10px]">اردو / English</p></div>
              <div className="ml-auto w-2 h-2 bg-green-400 rounded-full"/>
            </div>
            <div className="p-3 space-y-2">
              <div className="flex justify-end"><div className="bg-[#4f46e5] text-white text-xs px-3 py-2 rounded-2xl rounded-br-sm">آج کی sales کتنی ہے؟</div></div>
              <div className="flex justify-start"><div className="bg-[#1a1a1a] border border-[#1e1e1e] text-gray-300 text-xs px-3 py-2 rounded-2xl rounded-bl-sm">آج کی کل سیلز <span className="font-bold" style={{color:"#e8ff47"}}>PKR 284,500</span> ہے۔</div></div>
              <div className="flex justify-end"><div className="bg-[#4f46e5] text-white text-xs px-3 py-2 rounded-2xl rounded-br-sm">Monthly chart dikhao</div></div>
              <div className="flex justify-start">
                <div className="bg-[#1a1a1a] border border-[#1e1e1e] text-gray-300 text-xs px-3 py-2 rounded-2xl rounded-bl-sm">
                  <div className="flex gap-0.5 items-end h-7 mb-1">
                    {[40,55,35,70,60,85,75,90,65,80,70,100].map((h,i)=>(
                      <div key={i} className="flex-1 rounded-sm" style={{height:`${h}%`,background:"#e8ff47",opacity:.75}}/>
                    ))}
                  </div>
                  Monthly revenue ☝️
                </div>
              </div>
            </div>
            <div className="px-3 pb-3"><div className="border border-[#1e1e1e] rounded-xl px-3 py-2 text-xs text-[#5a5a5a] flex items-center gap-2"><span>اردو یا English...</span><span className="ml-auto" style={{color:"#e8ff47"}}>🎙️</span></div></div>
          </div>
          <div className="absolute -bottom-3 -right-3 w-12 h-12 rounded-full bg-[#4f46e5] flex items-center justify-center shadow-lg" style={{animation:"pl 3s infinite"}}>
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
          </div>
        </div>
      </section>

      {/* STATS */}
      <div className="border-y border-[#1e1e1e] flex flex-col md:flex-row">
        {[["100%","Free voice — no API cost"],["< 2s","Average response"],["∞","Questions per day"],["2","Languages: Urdu + English"]].map(([n,l],i)=>(
          <div key={i} className="flex-1 py-7 px-10 border-b md:border-b-0 md:border-r border-[#1e1e1e] last:border-0">
            <div className="fd text-4xl" style={{color:"#e8ff47"}}>{n}</div>
            <div className="fm text-xs text-[#5a5a5a] uppercase tracking-wider mt-1">{l}</div>
          </div>
        ))}
      </div>

      {/* FEATURES */}
      <section id="features" className="py-20 px-6 md:px-12 bg-[#0d0d0d]">
        <div className="fm text-xs uppercase tracking-widest mb-3" style={{color:"#e8ff47"}}> Features</div>
        <h2 className="fd tracking-wide mb-14" style={{fontSize:"clamp(36px,6vw,72px)"}}>EVERYTHING<br/>IN ONE BOT</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px bg-[#1e1e1e] border border-[#1e1e1e]">
          {FEATURES.map((f,i)=>(
            <div key={i} className="bg-black p-8 card border border-transparent">
              <span className="text-3xl block mb-4">{f.icon}</span>
              <div className="fm text-[10px] tracking-widest mb-2" style={{color:"#e8ff47"}}>{f.tag}</div>
              <h3 className="fd text-2xl tracking-wide mb-3">{f.title}</h3>
              <p className="text-sm text-[#5a5a5a] leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how" className="py-20 px-6 md:px-12">
        <div className="fm text-xs uppercase tracking-widest mb-3" style={{color:"#e8ff47"}}> How It Works</div>
        <h2 className="fd tracking-wide mb-14" style={{fontSize:"clamp(36px,6vw,72px)"}}>4 STEPS.<br/>THAT'S IT.</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-px bg-[#1e1e1e] border border-[#1e1e1e]">
          {STEPS.map((s,i)=>(
            <div key={i} className="bg-black p-8 card border border-transparent">
              <div className="fd text-6xl opacity-30 mb-4" style={{color:"#e8ff47"}}>{s.num}</div>
              <h3 className="fd text-2xl tracking-wide mb-3">{s.title}</h3>
              <p className="text-sm text-[#5a5a5a] leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>
        <div className="mt-10 bg-[#0d0d0d] border border-[#1e1e1e] p-6 max-w-2xl">
          <p className="fm text-xs text-[#5a5a5a] mb-3">// Step 3 — paste this in your app before &lt;/body&gt;:</p>
          <code className="fm text-sm break-all" style={{color:"#e8ff47"}}>{`<script src="https://awkt-ld.vercel.app/embed.js"\n  data-api-key="YOUR_KEY_HERE"></script>`}</code>
          <p className="fm text-xs text-[#5a5a5a] mt-3">// That's all. The chat button appears automatically.</p>
        </div>
      </section>

      {/* COMPATIBLE */}
      <section id="compatible" className="py-20 px-6 md:px-12 bg-[#0d0d0d] border-t border-[#1e1e1e]">
        <div className="fm text-xs uppercase tracking-widest mb-3" style={{color:"#e8ff47"}}> Compatible With</div>
        <h2 className="fd tracking-wide mb-14" style={{fontSize:"clamp(36px,6vw,72px)"}}>WORKS WITH<br/>ANY APP</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {COMPATIBLE.map((app,i)=>(
            <div key={i} className="border border-[#1e1e1e] px-5 py-4 card cursor-default">
              <p className="fm text-xs mb-1" style={{color:"#e8ff47"}}>✓</p>
              <p className="text-sm font-medium">{app}</p>
            </div>
          ))}
        </div>
        <p className="fm text-xs text-[#5a5a5a] mt-6">// If it has a PostgreSQL or MySQL database, AWKT-LD BOT can read it.</p>
      </section>

      {/* CTA */}
      <section className="py-24 px-6 md:px-12 grid-bg text-center relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none" style={{background:"radial-gradient(ellipse at center,rgba(232,255,71,0.06) 0%,transparent 70%)"}}/>
        <div className="relative z-10">
          <div className="fm text-xs uppercase tracking-widest mb-4" style={{color:"#e8ff47"}}> Get Started</div>
          <h2 className="fd tracking-tighter mb-6" style={{fontSize:"clamp(48px,9vw,110px)",lineHeight:1}}>START CHATTING<br/>WITH YOUR DATA</h2>
          <p className="text-[#5a5a5a] max-w-md mx-auto mb-10 text-lg font-light">Connect your first app in 5 minutes. Free forever.</p>
          <div className="flex justify-center gap-4 flex-wrap">
            <Link href="/register" className="px-10 py-5 text-lg font-bold text-black transition hover:-translate-y-1" style={{background:"#e8ff47"}}>Create Free Account →</Link>
            <Link href="/login" className="px-10 py-5 text-lg font-medium border border-[#1e1e1e] text-white hover:border-[#e8ff47] hover:text-[#e8ff47] transition-colors">Sign In</Link>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-[#1e1e1e] py-10 px-6 md:px-12 flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="fd text-2xl tracking-wider">AWK<span style={{color:"#e8ff47"}}> TLD</span><span className="fm text-xs border border-[#1e1e1e] text-[#5a5a5a] ml-2 px-2 py-0.5 align-middle">BOT</span></div>
        <div className="flex gap-6 fm text-xs text-[#5a5a5a]">
          <Link href="/login" className="hover:text-[#e8ff47] transition-colors">Sign In</Link>
          <Link href="/register" className="hover:text-[#e8ff47] transition-colors">Register</Link>
          <Link href="/dashboard" className="hover:text-[#e8ff47] transition-colors">Dashboard</Link>
        </div>
        <p className="fm text-xs text-[#5a5a5a]">// © 2026 AWK TLD — AI Database Assistant</p>
      </footer>
    </div>
  );
}