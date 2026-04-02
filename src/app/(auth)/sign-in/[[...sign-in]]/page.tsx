"use client";

import { useSignIn, useAuth, useClerk } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { GoogleIcon } from "@/components/icons/google";
import { useState, useEffect, useRef } from "react";

export default function SignInPage() {
  const { signIn, fetchStatus } = useSignIn();
  const { isSignedIn } = useAuth();
  const { signOut } = useClerk();
  const [isLoading, setIsLoading] = useState(false);
  const signOutAttempted = useRef(false);

  // If Clerk thinks the user is signed in but they landed on /sign-in,
  // the server-side session is likely stale. Sign out to clear client state.
  useEffect(() => {
    if (isSignedIn && !signOutAttempted.current) {
      signOutAttempted.current = true;
      signOut();
    }
  }, [isSignedIn, signOut]);

  const isFetching = fetchStatus === "fetching";

  const handleGoogleSignIn = async () => {
    if (isFetching) return;
    setIsLoading(true);
    try {
      await signIn.sso({
        strategy: "oauth_google",
        redirectUrl: "/",
        redirectCallbackUrl: "/sso-callback",
      });
    } catch (err) {
      console.error("Sign-in error:", err);
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-sm border-0 shadow-none bg-transparent">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl font-bold">Welcome back</CardTitle>
        <CardDescription>
          Sign in to your Rollup OS account
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button
          variant="outline"
          size="lg"
          className="w-full h-12 text-base font-medium"
          onClick={handleGoogleSignIn}
          disabled={isFetching || isLoading}
        >
          <GoogleIcon className="size-5" />
          {isLoading ? "Redirecting..." : "Continue with Google"}
        </Button>
      </CardContent>
    </Card>
  );
}
