"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const nav = [
  { icon: "💬", label: "AI Chat", href: "/dashboard" },
  { icon: "🔌", label: "Connected Apps", href: "/dashboard/widget-sites" },
  { icon: "⚙️", label: "Settings", href: "/settings" },
];

export default function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="w-56 border-r border-gray-100 bg-white hidden md:flex flex-col py-6 px-3 shrink-0">
      <nav className="space-y-1">
        {nav.map(item => {
          const active = pathname === item.href;
          return (
            <Link key={item.href} href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors ${active ? "bg-indigo-50 text-indigo-700 font-medium" : "text-gray-600 hover:bg-gray-50"}`}>
              <span className="text-base">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto p-3 bg-indigo-50 rounded-xl border border-indigo-100">
        <p className="text-xs text-indigo-700 font-medium mb-1">Tip</p>
        <p className="text-xs text-indigo-600 leading-relaxed" dir="rtl">مائیک بٹن دبا کر اردو میں بولیں</p>
        <p className="text-xs text-indigo-500 mt-1">Or type in English</p>
      </div>
    </aside>
  );
}