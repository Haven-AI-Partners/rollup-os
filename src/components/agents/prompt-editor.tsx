"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Save, RotateCcw, History, Eye, Pencil, Check } from "lucide-react";
import { savePromptVersion, activatePromptVersion, resetToDefaultPrompt } from "@/lib/actions/prompt-versions";

interface PromptVersion {
  id: string;
  version: number;
  template: string;
  isActive: boolean;
  changeNote: string | null;
  createdAt: string;
}

interface PromptEditorProps {
  portcoSlug: string;
  agentSlug: string;
  currentTemplate: string;
  defaultTemplate: string;
  renderedPrompt: string;
  versions: PromptVersion[];
  isAdmin: boolean;
  title?: string;
  description?: string;
  /** When true, renders without a Card wrapper (for embedding inside PromptTabs) */
  embedded?: boolean;
}

export function PromptEditor({
  portcoSlug,
  agentSlug,
  currentTemplate,
  defaultTemplate,
  renderedPrompt,
  versions,
  isAdmin,
  title = "System Prompt",
  description = "The instructions sent to the AI model. Use {{SCORING_RUBRIC}}, {{RED_FLAGS}}, {{MARKET_CONTEXT}} as placeholders for dynamic content.",
  embedded = false,
}: PromptEditorProps) {
  const [template, setTemplate] = useState(currentTemplate);
  const [changeNote, setChangeNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [activating, setActivating] = useState<string | null>(null);
  const [tab, setTab] = useState<"edit" | "preview" | "history">("edit");

  const isDirty = template !== currentTemplate;
  const isDefault = currentTemplate === defaultTemplate;

  async function handleSave() {
    setSaving(true);
    try {
      await savePromptVersion(portcoSlug, agentSlug, template, changeNote);
      setChangeNote("");
    } finally {
      setSaving(false);
    }
  }

  async function handleReset() {
    setResetting(true);
    try {
      await resetToDefaultPrompt(portcoSlug, agentSlug);
      setTemplate(defaultTemplate);
    } finally {
      setResetting(false);
    }
  }

  async function handleActivate(versionId: string) {
    setActivating(versionId);
    try {
      await activatePromptVersion(portcoSlug, agentSlug, versionId);
      const version = versions.find((v) => v.id === versionId);
      if (version) {
        setTemplate(version.template);
      }
    } finally {
      setActivating(null);
    }
  }

  const versionBadge = (
    <div className="flex items-center gap-1">
      {isDefault ? (
        <Badge variant="secondary">Default</Badge>
      ) : (
        <Badge>Custom v{versions.find((v) => v.isActive)?.version}</Badge>
      )}
    </div>
  );

  const innerTabs = (
    <div className="flex gap-1 border-b -mb-2 mt-2">
      <button
        onClick={() => setTab("edit")}
        className={`px-3 py-1.5 text-xs font-medium border-b-2 -mb-px transition-colors flex items-center gap-1 ${
          tab === "edit"
            ? "border-primary text-foreground"
            : "border-transparent text-muted-foreground hover:text-foreground"
        }`}
      >
        <Pencil className="size-3" />
        Template
      </button>
      <button
        onClick={() => setTab("preview")}
        className={`px-3 py-1.5 text-xs font-medium border-b-2 -mb-px transition-colors flex items-center gap-1 ${
          tab === "preview"
            ? "border-primary text-foreground"
            : "border-transparent text-muted-foreground hover:text-foreground"
        }`}
      >
        <Eye className="size-3" />
        Preview
      </button>
      <button
        onClick={() => setTab("history")}
        className={`px-3 py-1.5 text-xs font-medium border-b-2 -mb-px transition-colors flex items-center gap-1 ${
          tab === "history"
            ? "border-primary text-foreground"
            : "border-transparent text-muted-foreground hover:text-foreground"
        }`}
      >
        <History className="size-3" />
        History ({versions.length})
      </button>
    </div>
  );

  const content = (
    <>
      {tab === "edit" && (
        <div className="space-y-3">
          <Textarea
            value={template}
            onChange={(e) => setTemplate(e.target.value)}
            className="font-mono text-xs min-h-[400px] leading-relaxed"
            readOnly={!isAdmin}
          />
          {isAdmin && (
            <div className="flex items-center gap-2">
              <Input
                value={changeNote}
                onChange={(e) => setChangeNote(e.target.value)}
                placeholder="Change note (optional)"
                className="text-sm flex-1"
              />
              <Button
                size="sm"
                onClick={handleSave}
                disabled={!isDirty || saving}
                className="gap-1.5"
              >
                <Save className="size-3.5" />
                {saving ? "Saving..." : "Save Version"}
              </Button>
              {!isDefault && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleReset}
                  disabled={resetting}
                  className="gap-1.5"
                >
                  <RotateCcw className="size-3.5" />
                  {resetting ? "Resetting..." : "Reset to Default"}
                </Button>
              )}
            </div>
          )}
        </div>
      )}

      {tab === "preview" && (
        <pre className="whitespace-pre-wrap text-xs font-mono bg-muted/50 rounded-md p-4 max-h-[500px] overflow-y-auto leading-relaxed">
          {renderedPrompt}
        </pre>
      )}

      {tab === "history" && (
        <div className="space-y-2">
          {versions.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No saved versions yet. Using the default code-defined prompt.
            </p>
          ) : (
            versions.map((v) => (
              <div
                key={v.id}
                className="flex items-center justify-between rounded-md border px-3 py-2"
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">v{v.version}</span>
                  {v.isActive && (
                    <Badge variant="default" className="text-[10px]">
                      Active
                    </Badge>
                  )}
                  {v.changeNote && (
                    <span className="text-xs text-muted-foreground">
                      — {v.changeNote}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    {new Date(v.createdAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                  {isAdmin && !v.isActive && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1 text-xs h-7"
                      onClick={() => handleActivate(v.id)}
                      disabled={activating === v.id}
                    >
                      <Check className="size-3" />
                      {activating === v.id ? "..." : "Activate"}
                    </Button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </>
  );

  if (embedded) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">{description}</p>
          {versionBadge}
        </div>
        {innerTabs}
        <div className="pt-2">
          {content}
        </div>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
          {versionBadge}
        </div>
        {innerTabs}
      </CardHeader>
      <CardContent>
        {content}
      </CardContent>
    </Card>
  );
}
