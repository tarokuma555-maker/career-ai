"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Send,
  Bot,
  User,
  ArrowLeft,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

// ---------- 型定義 ----------
interface Message {
  role: "user" | "assistant";
  content: string;
}

// ---------- 定数 ----------
const INITIAL_MESSAGE: Message = {
  role: "assistant",
  content:
    "キャリアプランの結果を踏まえて、何でもご質問ください。\n具体的なキャリアパスの詳細や、スキルアップの方法、転職活動の進め方など、お気軽にどうぞ。",
};

const SUGGESTION_TEMPLATES = [
  "一番おすすめのキャリアパスの詳細を教えて",
  "必要なスキルを身につけるには？",
  "転職活動の具体的なスケジュールは？",
  "この業界の将来性は？",
];

// ---------- タイピングインジケーター ----------
function TypingIndicator() {
  return (
    <div className="flex justify-start">
      <div className="flex items-start gap-2 max-w-[80%]">
        <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
          <Bot className="w-4 h-4 text-primary" />
        </div>
        <div className="bg-muted rounded-2xl rounded-tl-sm px-4 py-3">
          <div className="flex gap-1.5">
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                className="w-2 h-2 bg-muted-foreground/50 rounded-full"
                animate={{ y: [0, -6, 0] }}
                transition={{
                  duration: 0.6,
                  repeat: Infinity,
                  delay: i * 0.15,
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------- メッセージバブル ----------
function MessageBubble({ message, index }: { message: Message; index: number }) {
  const isUser = message.role === "user";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: index === 0 ? 0 : 0.05 }}
      className={`flex ${isUser ? "justify-end" : "justify-start"}`}
    >
      <div
        className={`flex items-start gap-2 max-w-[85%] sm:max-w-[75%] ${
          isUser ? "flex-row-reverse" : ""
        }`}
      >
        {/* アイコン */}
        <div
          className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
            isUser ? "bg-primary" : "bg-primary/10"
          }`}
        >
          {isUser ? (
            <User className="w-4 h-4 text-primary-foreground" />
          ) : (
            <Bot className="w-4 h-4 text-primary" />
          )}
        </div>

        {/* バブル */}
        <div
          className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap break-words ${
            isUser
              ? "bg-primary text-primary-foreground rounded-tr-sm"
              : "bg-muted rounded-tl-sm"
          }`}
        >
          {message.content}
        </div>
      </div>
    </motion.div>
  );
}

// ---------- メインページ ----------
export default function ChatPage() {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([INITIAL_MESSAGE]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // コンテキストデータ（初回読み込み）
  const contextRef = useRef<{
    diagnosisData?: Record<string, unknown>;
    analysisResult?: Record<string, unknown>;
  }>({});

  useEffect(() => {
    try {
      const diag = localStorage.getItem("diagnosisData");
      const result = localStorage.getItem("analysisResult");
      contextRef.current = {
        diagnosisData: diag ? JSON.parse(diag) : undefined,
        analysisResult: result ? JSON.parse(result) : undefined,
      };
    } catch {
      // データがなくてもチャットは利用可
    }
  }, []);

  // 自動スクロール
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isStreaming]);

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isStreaming) return;

      setShowSuggestions(false);
      setInput("");

      const userMessage: Message = { role: "user", content: trimmed };
      const updatedMessages = [...messages, userMessage];
      setMessages(updatedMessages);
      setIsStreaming(true);

      // API用の会話履歴（初回メッセージは除く）
      const apiMessages = updatedMessages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: apiMessages,
            ...contextRef.current,
          }),
          signal: controller.signal,
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(
            err.error ?? `エラーが発生しました (${res.status})`
          );
        }

        const reader = res.body?.getReader();
        if (!reader) throw new Error("ストリームの取得に失敗しました。");

        const decoder = new TextDecoder();
        let assistantContent = "";

        // 空のassistantメッセージを追加
        setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

        let buffer = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const payload = line.slice(6).trim();
            if (payload === "[DONE]") break;

            try {
              const parsed = JSON.parse(payload);
              if (parsed.error) throw new Error(parsed.error);
              if (parsed.text) {
                assistantContent += parsed.text;
                const snapshot = assistantContent;
                setMessages((prev) => {
                  const next = [...prev];
                  next[next.length - 1] = {
                    role: "assistant",
                    content: snapshot,
                  };
                  return next;
                });
              }
            } catch (e) {
              if (e instanceof Error && e.message !== payload) {
                throw e;
              }
            }
          }
        }
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        const errorMsg =
          err instanceof Error
            ? err.message
            : "エラーが発生しました。もう一度お試しください。";
        setMessages((prev) => {
          // 空のassistantメッセージがあれば置き換え、なければ追加
          const last = prev[prev.length - 1];
          if (last?.role === "assistant" && last.content === "") {
            const next = [...prev];
            next[next.length - 1] = {
              role: "assistant",
              content: `⚠️ ${errorMsg}`,
            };
            return next;
          }
          return [
            ...prev,
            { role: "assistant", content: `⚠️ ${errorMsg}` },
          ];
        });
      } finally {
        setIsStreaming(false);
        abortRef.current = null;
      }
    },
    [messages, isStreaming]
  );

  const handleSend = () => sendMessage(input);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSuggestion = (text: string) => {
    sendMessage(text);
  };

  return (
    <main className="h-dvh flex flex-col">
      {/* ヘッダー */}
      <header className="border-b px-4 py-3 flex items-center gap-3 flex-shrink-0">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => router.back()}
        >
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
            <Bot className="w-4 h-4 text-primary" />
          </div>
          <div>
            <p className="text-sm font-medium leading-tight">キャリアAI</p>
            <p className="text-xs text-muted-foreground">
              {isStreaming ? "入力中..." : "オンライン"}
            </p>
          </div>
        </div>
      </header>

      {/* メッセージエリア */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.map((msg, i) => (
          <MessageBubble key={i} message={msg} index={i} />
        ))}

        {isStreaming &&
          messages[messages.length - 1]?.content === "" && (
            <TypingIndicator />
          )}

        {/* 提案テンプレート */}
        <AnimatePresence>
          {showSuggestions && messages.length === 1 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ delay: 0.3 }}
              className="space-y-3 pt-2"
            >
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Sparkles className="w-3.5 h-3.5" />
                こんな質問はいかがですか？
              </div>
              <div className="flex flex-wrap gap-2">
                {SUGGESTION_TEMPLATES.map((text) => (
                  <button
                    key={text}
                    onClick={() => handleSuggestion(text)}
                    className="text-sm border rounded-full px-3 py-1.5 hover:bg-accent transition-colors text-left"
                  >
                    {text}
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div ref={messagesEndRef} />
      </div>

      {/* 入力エリア */}
      <div className="border-t px-4 py-3 flex-shrink-0">
        <div className="max-w-2xl mx-auto flex items-end gap-2">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="メッセージを入力..."
            disabled={isStreaming}
            rows={1}
            className="min-h-[40px] max-h-[120px] resize-none"
          />
          <Button
            size="icon"
            onClick={handleSend}
            disabled={!input.trim() || isStreaming}
            className="h-10 w-10 flex-shrink-0"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </main>
  );
}
