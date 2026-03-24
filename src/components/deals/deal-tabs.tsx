"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const tabs = [
  { label: "Overview", segment: "overview" },
  { label: "Profile", segment: "profile" },
  { label: "Thesis", segment: "thesis" },
  { label: "Organization", segment: "organization" },
  { label: "Files", segment: "files" },
  { label: "Tasks", segment: "tasks" },
  { label: "Comments", segment: "comments" },
  { label: "Financials", segment: "financials" },
  { label: "Activity", segment: "activity" },
];

interface DealTabsProps {
  basePath: string;
}

export function DealTabs({ basePath }: DealTabsProps) {
  const pathname = usePathname();

  return (
    <nav className="flex gap-1 -mb-px">
      {tabs.map((tab) => {
        const href = `${basePath}/${tab.segment}`;
        const isActive = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={tab.segment}
            href={href}
            className={cn(
              "px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
              isActive
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30"
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
