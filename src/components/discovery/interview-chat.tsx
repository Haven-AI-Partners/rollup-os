"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Send, Pause, Loader2, Bot, User } from "lucide-react";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

function BotAvatar() {
  return (
    <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
      <Bot className="size-4 text-primary" />
    </div>
  );
}

function UserAvatar() {
  return (
    <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted">
      <User className="size-4 text-muted-foreground" />
    </div>
  );
}

interface InterviewChatProps {
  sessionId: string;
  employeeName: string;
  onSessionComplete?: () => void;
}

export function InterviewChat({ sessionId, employeeName, onSessionComplete }: InterviewChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [paused, setPaused] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const idCounter = useRef(0);
  const hasGreeted = useRef(false);

  const nextId = () => String(++idCounter.current);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const sendToApi = useCallback(async (allMessages: Message[]) => {
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/interview/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: allMessages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response body");

      const assistantId = nextId();
      setMessages((prev) => [...prev, { id: assistantId, role: "assistant", content: "" }]);

      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId ? { ...m, content: m.content + chunk } : m
          )
        );
      }
    } catch (e) {
      console.error("Chat error:", e);
      setError("エラーが発生しました。もう一度お試しください。");
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Auto-greet on mount
  useEffect(() => {
    if (hasGreeted.current) return;
    hasGreeted.current = true;

    // Send a system-triggered greeting request
    const initMessage: Message = {
      id: nextId(),
      role: "user",
      content: "こんにちは",
    };
    setMessages([initMessage]);
    sendToApi([initMessage]);
  }, [sendToApi]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = inputValue.trim();
    if (!text || isLoading) return;

    const userMessage: Message = { id: nextId(), role: "user", content: text };
    const newMessages = [...messages, userMessage];
    setInputValue("");
    setMessages(newMessages);
    sendToApi(newMessages);
  }

  if (paused) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
        <Card className="w-full max-w-md p-8 text-center">
          <Pause className="mx-auto mb-4 size-12 text-muted-foreground" />
          <h2 className="text-lg font-semibold">ヒアリングを一時停止中</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            いつでも再開できます。進捗は保存されています。
          </p>
          <Button className="mt-4" onClick={() => setPaused(false)}>
            再開する
          </Button>
        </Card>
      </div>
    );
  }

  // Hide the auto-greeting "こんにちは" from the user — show from assistant response onward
  const visibleMessages = messages.slice(1);

  return (
    <div className="flex h-screen flex-col bg-background">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-full bg-primary/10">
            <Bot className="size-4 text-primary" />
          </div>
          <div>
            <p className="text-sm font-medium">太郎 — 業務ヒアリング</p>
            <p className="text-xs text-muted-foreground">{employeeName}さん</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={() => setPaused(true)}>
            <Pause className="mr-1 size-3.5" />
            一時停止
          </Button>
          {onSessionComplete && (
            <Button variant="ghost" size="sm" onClick={onSessionComplete} className="text-muted-foreground">
              終了する
            </Button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        {visibleMessages.length === 0 && isLoading && (
          <div className="flex gap-3">
            <BotAvatar />
            <div className="rounded-lg bg-muted px-4 py-2.5">
              <Loader2 className="size-4 animate-spin text-muted-foreground" />
            </div>
          </div>
        )}
        {visibleMessages.map((message) => (
          <div
            key={message.id}
            className={`flex gap-3 ${message.role === "user" ? "justify-end" : ""}`}
          >
            {message.role === "assistant" && (
              <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
                <Bot className="size-4 text-primary" />
              </div>
            )}
            <div
              className={`rounded-lg px-4 py-2.5 max-w-[80%] text-sm whitespace-pre-wrap ${
                message.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted"
              }`}
            >
              {message.content}
            </div>
            {message.role === "user" && (
              <UserAvatar />
            )}
          </div>
        ))}
        {isLoading && visibleMessages.length > 0 && visibleMessages[visibleMessages.length - 1]?.role === "user" && (
          <div className="flex gap-3">
            <BotAvatar />
            <div className="rounded-lg bg-muted px-4 py-2.5">
              <Loader2 className="size-4 animate-spin text-muted-foreground" />
            </div>
          </div>
        )}
        {error && (
          <div className="text-center text-sm text-destructive">
            {error}
          </div>
        )}
      </div>

      {/* Input */}
      <div className="border-t p-4">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <Input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="メッセージを入力..."
            disabled={isLoading}
            className="flex-1"
          />
          <Button type="submit" size="icon" disabled={isLoading || !inputValue.trim()}>
            <Send className="size-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}
