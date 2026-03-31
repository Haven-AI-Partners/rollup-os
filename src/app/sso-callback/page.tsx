"use client";

import { AuthenticateWithRedirectCallback } from "@clerk/nextjs";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

const CALLBACK_TIMEOUT_MS = 10_000;

export default function SSOCallbackPage() {
  const [isTimedOut, setIsTimedOut] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsTimedOut(true), CALLBACK_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4">
      <Loader2 className="size-8 animate-spin text-muted-foreground" />
      <p className="text-sm text-muted-foreground">Signing you in...</p>
      {isTimedOut && (
        <div className="text-center space-y-2">
          <p className="text-sm text-muted-foreground">
            Taking longer than expected.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => (window.location.href = "/sign-in")}
          >
            Back to sign in
          </Button>
        </div>
      )}
      <AuthenticateWithRedirectCallback
        signInFallbackRedirectUrl="/"
        signUpFallbackRedirectUrl="/"
      />
    </div>
  );
}
