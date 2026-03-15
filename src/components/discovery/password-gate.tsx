"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Lock, AlertCircle } from "lucide-react";

interface PasswordGateProps {
  sessionId: string;
  employeeName: string;
  companyName: string;
  onAuthenticated: () => void;
}

export function PasswordGate({ sessionId, employeeName, companyName, onAuthenticated }: PasswordGateProps) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/interview/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "認証に失敗しました");
        return;
      }

      onAuthenticated();
    } catch {
      setError("接続エラーが発生しました。もう一度お試しください。");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-full bg-primary/10">
            <Lock className="size-6 text-primary" />
          </div>
          <CardTitle className="text-xl">業務ヒアリング</CardTitle>
          <CardDescription>
            {employeeName}さん、こんにちは。
            <br />
            {companyName}の業務プロセスについてお話を伺います。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">パスワード</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="メールに記載されたパスワードを入力"
                autoFocus
              />
            </div>
            {error && (
              <div className="flex items-center gap-2 text-sm text-destructive">
                <AlertCircle className="size-4 shrink-0" />
                {error}
              </div>
            )}
            <Button type="submit" className="w-full" disabled={loading || !password}>
              {loading ? "認証中..." : "ヒアリングを開始"}
            </Button>
          </form>
          <p className="mt-4 text-center text-xs text-muted-foreground">
            パスワードがわからない場合は、管理者にお問い合わせください。
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
