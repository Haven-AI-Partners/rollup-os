"use client";

import * as Clerk from "@clerk/elements/sign-up";
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

export default function SignUpPage() {
  return (
    <Clerk.Root>
      <Clerk.Step name="start">
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
      </Clerk.Step>
    </Clerk.Root>
  );
}
