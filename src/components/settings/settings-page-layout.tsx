import { SettingsNav } from "@/components/settings/settings-nav";
import type { ReactNode } from "react";

interface SettingsPageLayoutProps {
  portcoSlug: string;
  portcoName: string;
  children: ReactNode;
  maxWidth?: boolean;
}

export function SettingsPageLayout({
  portcoSlug,
  portcoName,
  children,
  maxWidth = true,
}: SettingsPageLayoutProps) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="mt-1 text-muted-foreground">
          Manage {portcoName} configuration and integrations.
        </p>
      </div>

      <SettingsNav portcoSlug={portcoSlug} />

      <div className={maxWidth ? "max-w-2xl space-y-6" : "space-y-4"}>
        {children}
      </div>
    </div>
  );
}
