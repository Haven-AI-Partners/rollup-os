"use client";

import { useState } from "react";
import { PasswordGate } from "@/components/discovery/password-gate";
import { InterviewChat } from "@/components/discovery/interview-chat";
import { Card } from "@/components/ui/card";
import { CheckCircle } from "lucide-react";

interface InterviewPageProps {
  sessionId: string;
  sessionStatus: string;
  employeeName: string;
  companyName: string;
}

export function InterviewPage({ sessionId, sessionStatus, employeeName, companyName }: InterviewPageProps) {
  const [authenticated, setAuthenticated] = useState(false);

  if (sessionStatus === "completed") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
        <Card className="w-full max-w-md p-8 text-center">
          <CheckCircle className="mx-auto mb-4 size-12 text-green-600" />
          <h2 className="text-lg font-semibold">ヒアリング完了</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {employeeName}さん、ご協力ありがとうございました。
            <br />
            回答は管理者に共有されます。
          </p>
        </Card>
      </div>
    );
  }

  if (!authenticated) {
    return (
      <PasswordGate
        sessionId={sessionId}
        employeeName={employeeName}
        companyName={companyName}
        onAuthenticated={() => setAuthenticated(true)}
      />
    );
  }

  return (
    <InterviewChat
      sessionId={sessionId}
      employeeName={employeeName}
    />
  );
}
