"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

interface SettingsNavProps {
  portcoSlug: string;
}

const tabs = [
  { title: "Integrations", href: "/settings/integrations" },
  { title: "Customization", href: "/settings/customization" },
];

export function SettingsNav({ portcoSlug }: SettingsNavProps) {
  const pathname = usePathname();

  return (
    <div className="flex gap-1 border-b">
      {tabs.map((tab) => {
        const fullPath = `/${portcoSlug}${tab.href}`;
        const isActive = pathname === fullPath || pathname.startsWith(`${fullPath}/`);
        return (
          <Link
            key={tab.href}
            href={fullPath}
            className={cn(
              "px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
              isActive
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30"
            )}
          >
            {tab.title}
          </Link>
        );
      })}
    </div>
  );
}
