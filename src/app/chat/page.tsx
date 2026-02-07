"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content:
        "こんにちは！キャリアについてお気軽にご相談ください。",
    },
  ]);
  const [input, setInput] = useState("");

  const handleSend = () => {
    if (!input.trim()) return;
    setMessages((prev) => [...prev, { role: "user", content: input }]);
    setInput("");
    // TODO: AI応答を実装
    setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "ご質問ありがとうございます。（AI応答は今後実装予定です）",
        },
      ]);
    }, 1000);
  };

  return (
    <main className="min-h-screen flex flex-col px-4 py-12">
      <div className="max-w-2xl mx-auto w-full flex-1 flex flex-col">
        <h1 className="text-2xl font-bold mb-6 text-center">
          AIキャリア相談
        </h1>

        <Card className="flex-1 flex flex-col">
          <CardHeader>
            <CardTitle className="text-lg">チャット</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col">
            <div className="flex-1 overflow-y-auto space-y-4 mb-4 min-h-[400px]">
              {messages.map((message, i) => (
                <div
                  key={i}
                  className={`flex ${
                    message.role === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  <div
                    className={`max-w-[80%] rounded-lg px-4 py-2 ${
                      message.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted"
                    }`}
                  >
                    {message.content}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSend()}
                placeholder="メッセージを入力..."
              />
              <Button onClick={handleSend}>送信</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
