"use client";

import { useState } from "react";

const menuItems = [
  { icon: "💬", label: "AI Chat", active: true },
  { icon: "🗄️", label: "Database", active: false },
  { icon: "📈", label: "Analytics", active: false },
  { icon: "🔍", label: "Explorer", active: false },
  { icon: "⚙️", label: "Settings", active: false },
];

const databaseConnections = [
  { name: "PostgreSQL", status: "connected", color: "bg-blue-500" },
  { name: "MySQL", status: "available", color: "bg-orange-500" },
  { name: "SQLite", status: "available", color: "bg-emerald-500" },
  { name: "MongoDB", status: "available", color: "bg-green-500" },
];

export default function Sidebar() {
  const [active, setActive] = useState("AI Chat");

  return (
    <aside className="w-64 border-r border-gray-200 bg-white h-full hidden md:block">
      <div className="p-6">
        <div className="mb-8">
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">
            Navigation
          </h3>
          <nav className="space-y-1">
            {menuItems.map((item) => (
              <button
                key={item.label}
                onClick={() => setActive(item.label)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${active === item.label
                    ? "bg-linear-to-r from-indigo-50 to-purple-50 text-indigo-700 border border-indigo-100"
                    : "text-gray-700 hover:bg-gray-50"
                  }`}
              >
                <span className="text-lg">{item.icon}</span>
                <span className="font-medium">{item.label}</span>
                {item.active && (
                  <span className="ml-auto w-2 h-2 bg-linear-to-r from-purple-600 to-indigo-600 rounded-full" />
                )}
              </button>
            ))}
          </nav>
        </div>

        <div className="mb-6">
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">
            Database Connections
          </h3>
          <div className="space-y-3">
            {databaseConnections.map((db) => (
              <div key={db.name} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 ${db.color} rounded-full`} />
                  <span className="text-sm text-gray-700">{db.name}</span>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full ${db.status === 'connected' 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-gray-100 text-gray-600'
                  }`}>
                  {db.status}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="p-4 bg-linear-to-r from-indigo-50 to-purple-50 rounded-xl border border-indigo-100">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-6 h-6 bg-linear-to-br from-purple-600 to-indigo-600 rounded flex items-center justify-center">
              <span className="text-white text-xs font-bold">AW</span>
            </div>
            <h4 className="font-medium text-gray-900">AWKT-LD Tip</h4>
          </div>
          <p className="text-sm text-gray-600">
            I can analyze any database schema automatically. Try asking about table relationships or data patterns.
          </p>
        </div>
      </div>
    </aside>
  );
}