"use client";

import { SignOutButton } from "@clerk/nextjs";

export function SignOutBtn() {
  return (
    <div className="mt-6">
      <SignOutButton>
        <button className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
          Sign out
        </button>
      </SignOutButton>
    </div>
  );
}
