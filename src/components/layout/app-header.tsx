"use client";

import { UserButton } from "@clerk/nextjs";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";

interface AppHeaderProps {
  portcoName: string;
}

export function AppHeader({ portcoName }: AppHeaderProps) {
  return (
    <header className="flex h-14 items-center gap-4 border-b px-4">
      <SidebarTrigger />
      <Separator orientation="vertical" className="h-6" />
      <div className="flex flex-1 items-center justify-between">
        <h2 className="text-sm font-medium text-muted-foreground">{portcoName}</h2>
        <UserButton />
      </div>
    </header>
  );
}
