"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PromptEditor } from "./prompt-editor";

interface PromptVersion {
  id: string;
  version: number;
  template: string;
  isActive: boolean;
  changeNote: string | null;
  createdAt: string;
}

interface PromptTabConfig {
  id: string;
  label: string;
  agentSlug: string;
  currentTemplate: string;
  defaultTemplate: string;
  renderedPrompt: string;
  versions: PromptVersion[];
  description: string;
}

interface LegacyVersion {
  id: string;
  version: number;
  changeNote: string | null;
  createdAt: string;
}

interface PromptTabsProps {
  portcoSlug: string;
  tabs: PromptTabConfig[];
  legacyVersions: LegacyVersion[];
  isAdmin: boolean;
}

export function PromptTabs({ portcoSlug, tabs, legacyVersions, isAdmin }: PromptTabsProps) {
  const [activeTab, setActiveTab] = useState(tabs[0]?.id ?? "");

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle className="text-base">System Prompts</CardTitle>
          <CardDescription>
            Two-pass pipeline: extraction reads the PDF, scoring evaluates the structured data.
          </CardDescription>
        </div>
        <div className="flex gap-1 border-b -mb-2 mt-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-1.5 text-xs font-medium border-b-2 -mb-px transition-colors ${
                activeTab === tab.id
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
            </button>
          ))}
          {legacyVersions.length > 0 && (
            <button
              onClick={() => setActiveTab("legacy")}
              className={`px-3 py-1.5 text-xs font-medium border-b-2 -mb-px transition-colors ${
                activeTab === "legacy"
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              Legacy ({legacyVersions.length})
            </button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {tabs.map((tab) => (
          <div key={tab.id} className={activeTab === tab.id ? "" : "hidden"}>
            <PromptEditor
              portcoSlug={portcoSlug}
              agentSlug={tab.agentSlug}
              currentTemplate={tab.currentTemplate}
              defaultTemplate={tab.defaultTemplate}
              renderedPrompt={tab.renderedPrompt}
              versions={tab.versions}
              isAdmin={isAdmin}
              description={tab.description}
              embedded
            />
          </div>
        ))}
        {activeTab === "legacy" && (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground mb-3">
              Previous single-pass prompt versions (before the two-pass split). Read-only.
            </p>
            {legacyVersions.map((v) => (
              <div
                key={v.id}
                className="flex items-center justify-between rounded-md border px-3 py-2"
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">v{v.version}</span>
                  <Badge variant="secondary" className="text-[10px]">
                    Legacy
                  </Badge>
                  {v.changeNote && (
                    <span className="text-xs text-muted-foreground">
                      — {v.changeNote}
                    </span>
                  )}
                </div>
                <span className="text-xs text-muted-foreground">
                  {new Date(v.createdAt).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
