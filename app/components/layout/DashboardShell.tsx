"use client";
import { ReactNode, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";

const NAV = [
  { icon: "💬", label: "AI Chat", href: "/dashboard" },
  { icon: "🔌", label: "Connected Apps", href: "/dashboard/widget-sites" },
  { icon: "⚙️", label: "Settings", href: "/dashboard/settings" },
];

export default function DashboardShell({ children, session }: { children: ReactNode; session: any }) {
  const pathname = usePathname();
  const [status, setStatus]     = useState({ database: false, ai: false });
  const [menuOpen, setMenuOpen] = useState(false);
  const [lang, setLang] = useState("auto");

  useEffect(() => {
    fetch("/api/user-preferences")
      .then(r => r.json())
      .then(d => { if (d.preferredLang) setLang(d.preferredLang); })
      .catch(() => {});

    const check = () => fetch("/api/health").then(r => r.json()).then(setStatus).catch(() => {});
    check();
    const t = setInterval(check, 30000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="h-screen bg-black text-white flex flex-col overflow-hidden" style={{ fontFamily: "'DM Sans',sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Space+Mono:wght@400;700&family=DM+Sans:wght@300;400;500;600&display=swap');
        .fd{font-family:'Bebas Neue',sans-serif;}
        .fm{font-family:'Space Mono',monospace;}
      `}</style>

      {/* Header - fixed, no scroll */}
      <header className="border-b border-[#1e1e1e] bg-black px-4 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <button className="md:hidden text-[#5a5a5a]" onClick={() => setMenuOpen(!menuOpen)}>☰</button>
          <Link href="/" className="fd text-xl tracking-wider">
            AWK<span style={{ color: "#e8ff47" }}> TLD</span>
            <span className="fm text-[10px] border border-[#e8ff47] ml-1.5 px-1.5 py-0.5 align-middle" style={{ color: "#e8ff47" }}>BOT</span>
          </Link>
        </div>

        <div className="flex items-center gap-2 fm text-[10px]">
          <span className={`px-2 py-1 border transition-colors ${
            status.database
              ? "border-green-500/40 text-green-400"
              : "border-red-500/30 text-red-400"
          }`}>
            DB {status.database ? "●" : "○"}
          </span>
          <span className={`px-2 py-1 border transition-colors ${
            status.ai
              ? "border-green-500/40 text-green-400"
              : "border-red-500/30 text-red-400"
          }`}>
            AI {status.ai ? "●" : "○"}
          </span>
          <span className="text-[#3a3a3a] hidden sm:block truncate max-w-[100px]">
            {session?.user?.name || session?.user?.email}
          </span>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="border border-[#1e1e1e] text-[#5a5a5a] px-3 py-1 hover:border-[#e8ff47] hover:text-[#e8ff47] transition-colors"
          >
            {isUr ? "خارج" : "Sign out"}
          </button>
        </div>
      </header>

      {/* Main content area - ONE scrollbar here */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* ONLY ONE SIDEBAR */}
        <aside className={`
          ${menuOpen ? "flex" : "hidden"} md:flex
          w-64 border-r border-[#1e1e1e] bg-black flex-col py-6 px-3 shrink-0
          absolute md:relative z-30 top-0 left-0 h-full md:h-auto
        `}>
          <nav className="space-y-1">
            {NAV.map(item => {
              const active = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
              return (
                <Link key={item.href} href={item.href} onClick={() => setMenuOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2.5 text-sm transition-colors ${active ? "border-l-2 pl-2.5 text-[#e8ff47]" : "text-[#5a5a5a] hover:text-white"}`}
                  style={active ? { borderColor: "#e8ff47" } : {}}>
                  <span>{item.icon}</span>
                  <span className={active ? "font-medium" : ""}>{item.label}</span>
                </Link>
              );
            })}
          </nav>
          <div className="mt-auto border border-[#e8ff47]/20 bg-[#e8ff47]/5 p-3">
            <p className="fm text-[10px] text-[#e8ff47] mb-1.5">// Quick tip</p>
            <p className="text-xs text-[#5a5a5a] leading-relaxed" dir="rtl">مائیک بٹن دبا کر اردو میں بولیں</p>
            <p className="fm text-[10px] text-[#3a3a3a] mt-1">// Or type in English</p>
          </div>
        </aside>

        {/* Mobile overlay */}
        {menuOpen && (
          <div
            className="fixed inset-0 bg-black/60 z-20 md:hidden"
            onClick={() => setMenuOpen(false)}
          />
        )}

        {/* Main content - THIS is where scrolling happens (ONCE) */}
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}