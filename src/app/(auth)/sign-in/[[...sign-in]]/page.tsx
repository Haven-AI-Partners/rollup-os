"use client";

import { useSignIn } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { GoogleIcon } from "@/components/icons/google";
import Link from "next/link";
import { useState } from "react";

export default function SignInPage() {
  const { signIn } = useSignIn();
  const [isLoading, setIsLoading] = useState(false);

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    const { error } = await signIn.sso({
      strategy: "oauth_google",
      redirectUrl: "/",
      redirectCallbackUrl: "/sso-callback",
    });
    if (error) {
      console.error("Sign-in error:", error);
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
          disabled={isLoading}
        >
          <GoogleIcon className="size-5" />
          {isLoading ? "Redirecting..." : "Continue with Google"}
        </Button>
      </CardContent>
      <CardFooter className="justify-center">
        <p className="text-sm text-muted-foreground">
          Don&apos;t have an account?{" "}
          <Link
            href="/sign-up"
            className="font-medium text-primary hover:underline"
          >
            Sign up
          </Link>
        </p>
      </CardFooter>
    </Card>
  );
}
