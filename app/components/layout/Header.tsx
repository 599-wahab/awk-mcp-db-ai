"use client";
import { useEffect, useState } from "react";
import { signOut } from "next-auth/react";

interface Props {
  session?: any;
}

export default function Header({ session }: Props) {
  const [status, setStatus] = useState({ database: false, ai: false });

  useEffect(() => {
    fetch("/api/health").then(r => r.json()).then(setStatus).catch(() => {});
  }, []);

  return (
    <header className="bg-white border-b border-gray-100 px-6 py-3 flex items-center justify-between shrink-0">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center shadow-sm shadow-indigo-200">
          <span className="text-white font-bold text-sm">AW</span>
        </div>
        <span className="font-semibold text-gray-900">AWKT-LD</span>
      </div>

      <div className="flex items-center gap-3 text-xs">
        <span className={`px-2.5 py-1 rounded-full font-medium ${status.database ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"}`}>
          DB {status.database ? "●" : "○"}
        </span>
        <span className={`px-2.5 py-1 rounded-full font-medium ${status.ai ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"}`}>
          AI {status.ai ? "●" : "○"}
        </span>
        {session?.user && (
          <>
            <span className="text-gray-400 hidden sm:block">{session.user.name || session.user.email}</span>
            <button onClick={() => signOut({ callbackUrl: "/login" })}
              className="text-gray-400 hover:text-gray-700 px-2 py-1 rounded-lg hover:bg-gray-100 transition-colors">
              Sign out
            </button>
          </>
        )}
      </div>
    </header>
  );
}