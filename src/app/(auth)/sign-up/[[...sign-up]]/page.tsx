"use client";

import { useSignUp } from "@clerk/nextjs";
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

export default function SignUpPage() {
  const { signUp } = useSignUp();
  const [isLoading, setIsLoading] = useState(false);

  const handleGoogleSignUp = async () => {
    setIsLoading(true);
    const { error } = await signUp.sso({
      strategy: "oauth_google",
      redirectUrl: "/",
      redirectCallbackUrl: "/sso-callback",
    });
    if (error) {
      console.error("Sign-up error:", error);
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-sm border-0 shadow-none bg-transparent">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl font-bold">
          Create your account
        </CardTitle>
        <CardDescription>
          Get started with Rollup OS today
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button
          variant="outline"
          size="lg"
          className="w-full h-12 text-base font-medium"
          onClick={handleGoogleSignUp}
          disabled={isLoading}
        >
          <GoogleIcon className="size-5" />
          {isLoading ? "Redirecting..." : "Continue with Google"}
        </Button>
      </CardContent>
      <CardFooter className="justify-center">
        <p className="text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link
            href="/sign-in"
            className="font-medium text-primary hover:underline"
          >
            Sign in
          </Link>
        </p>
      </CardFooter>
    </Card>
  );
}
