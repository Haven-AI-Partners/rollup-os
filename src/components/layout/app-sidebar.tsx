"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  LayoutDashboard,
  Kanban,
  Building2,
  Bot,
  BarChart3,
  FolderOpen,
  Settings,
  Briefcase,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  USER_ROLE_LABELS,
  USER_ROLE_COLORS,
  USER_ROLE_DESCRIPTIONS,
} from "@/lib/constants";
import { PortcoSwitcher } from "./portco-switcher";

interface AppSidebarProps {
  portcoSlug: string;
  portcos: Array<{ id: string; name: string; slug: string; industry: string | null }>;
  currentPortco: { id: string; name: string; slug: string; industry: string | null };
  userRole: string;
}

const dealFlowItems = [
  { title: "Pipeline", icon: Kanban, href: "/pipeline" },
  { title: "Brokers", icon: Building2, href: "/brokers" },
  { title: "Analytics", icon: BarChart3, href: "/analytics" },
];

const portfolioItems = [
  { title: "Overview", icon: LayoutDashboard, href: "/portfolio" },
  { title: "Companies", icon: Briefcase, href: "/portfolio/companies" },
  { title: "Analytics", icon: BarChart3, href: "/portfolio/analytics" },
];

const workspaceItems = [
  { title: "Files", icon: FolderOpen, href: "/files" },
  { title: "Agents", icon: Bot, href: "/agents" },
];

const adminItems = [
  { title: "Settings", icon: Settings, href: "/settings" },
];

export function AppSidebar({ portcoSlug, portcos, currentPortco, userRole }: AppSidebarProps) {
  const pathname = usePathname();

  const isActive = (href: string) => {
    const fullPath = `/${portcoSlug}${href}`;
    return pathname === fullPath || pathname.startsWith(`${fullPath}/`);
  };

  const showAdmin = userRole === "owner" || userRole === "admin";

  return (
    <Sidebar>
      <SidebarHeader className="border-b px-2 py-3">
        <Link href={`/${portcoSlug}/pipeline`} className="px-2 text-lg font-bold">
          Rollup OS
        </Link>
        <div className="mt-2">
          <PortcoSwitcher portcos={portcos} currentPortco={currentPortco} />
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Deal Flow</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {dealFlowItems.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton asChild isActive={isActive(item.href)}>
                    <Link href={`/${portcoSlug}${item.href}`}>
                      <item.icon className="size-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>Portfolio</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {portfolioItems.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton asChild isActive={isActive(item.href)}>
                    <Link href={`/${portcoSlug}${item.href}`}>
                      <item.icon className="size-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>Workspace</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {workspaceItems.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton asChild isActive={isActive(item.href)}>
                    <Link href={`/${portcoSlug}${item.href}`}>
                      <item.icon className="size-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        {showAdmin && (
          <SidebarGroup>
            <SidebarGroupLabel>Administration</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {adminItems.map((item) => (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton asChild isActive={isActive(item.href)}>
                      <Link href={`/${portcoSlug}${item.href}`}>
                        <item.icon className="size-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
      <SidebarFooter className="border-t p-4">
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            {currentPortco.industry ?? "M&A Platform"}
          </p>
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge
                variant="outline"
                className={`cursor-default text-xs ${USER_ROLE_COLORS[userRole] ?? ""}`}
              >
                {USER_ROLE_LABELS[userRole] ?? userRole}
              </Badge>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-60">
              <p className="text-xs">
                {USER_ROLE_DESCRIPTIONS[userRole] ?? "Unknown role"}
              </p>
            </TooltipContent>
          </Tooltip>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
