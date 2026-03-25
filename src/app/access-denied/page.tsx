import { auth, currentUser } from "@clerk/nextjs/server";
import { ALLOWED_DOMAINS } from "@/lib/allowed-domains";
import { redirect } from "next/navigation";
import { SignOutBtn } from "./sign-out-btn";

export default async function AccessDeniedPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const user = await currentUser();
  const email = user?.emailAddresses[0]?.emailAddress;

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="mx-auto max-w-md text-center">
        <div className="mb-6 text-5xl">🔒</div>
        <h1 className="text-2xl font-bold">Access Restricted</h1>
        <p className="mt-3 text-muted-foreground">
          {email ? (
            <>
              You&apos;re signed in as{" "}
              <span className="font-medium text-foreground">{email}</span>, but
              this domain is not authorized to access Rollup OS.
            </>
          ) : (
            "Your email domain is not authorized to access Rollup OS."
          )}
        </p>
        <div className="mt-6 rounded-lg border bg-muted/50 p-4 text-sm text-muted-foreground">
          <p className="font-medium text-foreground mb-2">Allowed domains</p>
          <ul className="space-y-1">
            {ALLOWED_DOMAINS.map((domain) => (
              <li key={domain} className="font-mono text-xs">
                @{domain}
              </li>
            ))}
          </ul>
        </div>
        <SignOutBtn />
      </div>
    </div>
  );
}
