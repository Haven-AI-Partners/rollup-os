"use client";

import * as Clerk from "@clerk/elements/sign-in";
import { Connection } from "@clerk/elements/common";
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

export default function SignInPage() {
  return (
    <Clerk.Root>
      <Clerk.Step name="start">
        <Card className="w-full max-w-sm border-0 shadow-none bg-transparent">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold">Welcome back</CardTitle>
            <CardDescription>
              Sign in to your Rollup OS account
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Connection name="google" asChild>
              <Button
                variant="outline"
                size="lg"
                className="w-full h-12 text-base font-medium"
              >
                <GoogleIcon className="size-5" />
                Continue with Google
              </Button>
            </Connection>
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
      </Clerk.Step>
    </Clerk.Root>
  );
}
