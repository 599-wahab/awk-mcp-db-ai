"use client";

import Header from "./components/layout/Header";
import Sidebar from "./components/layout/Sidebar";
import ChatBox from "./components/chat/ChatBox";

export default function Page() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <div className="flex">
        <Sidebar />
        <main className="flex-1 p-6">
          <ChatBox />
        </main>
      </div>
    </div>
  );
}
