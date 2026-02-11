"use client";

import { useState, useRef, useEffect } from "react";
import Button from "../ui/Button";
import Input from "../ui/input";
import Card from "../ui/Card";
import MessageBubble from "./MessageBubble";
import TypingIndicator from "./TypingIndicator";

export default function ChatBox() {
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function askAI(text: string) {
    setLoading(true);

    const res = await fetch("/api/ai", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-mcp-key": "erp-system-123",
      },
      body: JSON.stringify({ question: text }),
    });

    const data = await res.json();

    setMessages(m => [
      ...m,
      {
        id: Date.now().toString(),
        content: data.explanation,
        isUser: false,
        ...data,
      },
    ]);

    setLoading(false);
  }

  function handleSubmit() {
    if (!question.trim()) return;

    setMessages(m => [
      ...m,
      {
        id: Date.now().toString(),
        content: question,
        isUser: true,
      },
    ]);

    askAI(question);
    setQuestion("");
  }

  function handleDrillDown(value: string) {
    askAI(`Show detailed records for ${value}`);
  }

  return (
    <Card className="flex flex-col h-[80vh]">
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map(m => (
          <MessageBubble
            key={m.id}
            message={m}
            onDrillDown={handleDrillDown}
          />
        ))}
        {loading && <TypingIndicator />}
        <div ref={bottomRef} />
      </div>

      <div className="flex gap-2 p-4 border-t">
        <Input
          value={question}
          onChange={e => setQuestion(e.target.value)}
          onKeyDown={e => e.key === "Enter" && handleSubmit()}
        />
        <Button onClick={handleSubmit}>Ask</Button>
      </div>
    </Card>
  );
}
