"use client";

import { useState } from "react";
import { PasswordGate } from "@/components/discovery/password-gate";
import { InterviewChat } from "@/components/discovery/interview-chat";
import { SessionFeedback } from "@/components/discovery/session-feedback";
import { Card } from "@/components/ui/card";
import { CheckCircle } from "lucide-react";

interface InterviewPageProps {
  sessionId: string;
  sessionStatus: string;
  employeeName: string;
  companyName: string;
  hasFeedback: boolean;
}

export function InterviewPage({ sessionId, sessionStatus, employeeName, companyName, hasFeedback }: InterviewPageProps) {
  const [authenticated, setAuthenticated] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);

  // Already completed and feedback given
  if (sessionStatus === "completed" && hasFeedback) {
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

  // Already completed but no feedback yet — show feedback form
  if (sessionStatus === "completed" && !hasFeedback) {
    return <SessionFeedback sessionId={sessionId} employeeName={employeeName} />;
  }

  // User ended the session — show feedback
  if (showFeedback) {
    return <SessionFeedback sessionId={sessionId} employeeName={employeeName} />;
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
      onSessionComplete={() => setShowFeedback(true)}
    />
  );
}
