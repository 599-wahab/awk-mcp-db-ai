"use client";

// app/widget/page.tsx
// This page loads inside the popup iframe on external sites.
// Compact chat UI — Urdu + English bilingual, voice enabled.

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import ChatBox from "@/app/components/chat/ChatBox";

function WidgetInner() {
  const params = useSearchParams();
  const siteId = params.get("site") || "";

  return (
    <div className="h-screen flex flex-col bg-white">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-indigo-600 text-white">
        <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center font-bold text-sm">
          AW
        </div>
        <div>
          <p className="font-semibold text-sm leading-none">AWKT-LD Assistant</p>
          <p className="text-indigo-200 text-xs mt-0.5">اردو / English • AI Powered</p>
        </div>
        <div className="ml-auto w-2 h-2 bg-green-400 rounded-full" title="Online" />
      </div>

      {/* Chat — pass siteId so the API validates it */}
      <div className="flex-1 overflow-hidden">
        <ChatBox
          apiUrl="/api/ai"
          siteId={siteId}
        />
      </div>
    </div>
  );
}

export default function WidgetPage() {
  return (
    <Suspense fallback={<div className="p-4 text-gray-400 text-sm">Loading...</div>}>
      <WidgetInner />
    </Suspense>
  );
}