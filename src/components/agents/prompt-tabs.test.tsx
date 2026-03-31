/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent } from "@testing-library/react";

vi.mock("@/components/ui/card", () => ({
  Card: ({ children }: any) => <div>{children}</div>,
  CardContent: ({ children }: any) => <div>{children}</div>,
  CardDescription: ({ children }: any) => <p>{children}</p>,
  CardHeader: ({ children }: any) => <div>{children}</div>,
  CardTitle: ({ children }: any) => <h3>{children}</h3>,
}));

vi.mock("@/components/ui/badge", () => ({
  Badge: ({ children, ...props }: any) => <span {...props}>{children}</span>,
}));

vi.mock("./prompt-editor", () => ({
  PromptEditor: (props: any) => (
    <div data-testid={`prompt-editor-${props.agentSlug}`}>
      PromptEditor: {props.agentSlug}
    </div>
  ),
}));

vi.mock("@/lib/format", () => ({
  formatDateTime: (d: string) => d,
}));

import { PromptTabs } from "./prompt-tabs";

const defaultTabs = [
  {
    id: "extraction",
    label: "Extraction",
    agentSlug: "extract",
    currentTemplate: "template-1",
    defaultTemplate: "default-1",
    renderedPrompt: "rendered-1",
    versions: [],
    description: "Extract data from PDF",
  },
  {
    id: "scoring",
    label: "Scoring",
    agentSlug: "score",
    currentTemplate: "template-2",
    defaultTemplate: "default-2",
    renderedPrompt: "rendered-2",
    versions: [],
    description: "Score the deal",
  },
];

const legacyVersions = [
  {
    id: "v1",
    version: 1,
    changeNote: "Initial version",
    createdAt: "2024-01-01",
  },
];

describe("PromptTabs", () => {
  it("renders tabs", () => {
    render(
      <PromptTabs
        portcoSlug="test"
        tabs={defaultTabs}
        legacyVersions={[]}
        isAdmin={true}
      />
    );
    expect(screen.getByText("System Prompts")).toBeInTheDocument();
    expect(screen.getByText("Extraction")).toBeInTheDocument();
    expect(screen.getByText("Scoring")).toBeInTheDocument();
  });

  it("renders prompt editors for each tab", () => {
    render(
      <PromptTabs
        portcoSlug="test"
        tabs={defaultTabs}
        legacyVersions={[]}
        isAdmin={true}
      />
    );
    expect(screen.getByTestId("prompt-editor-extract")).toBeInTheDocument();
    expect(screen.getByTestId("prompt-editor-score")).toBeInTheDocument();
  });

  it("switches tabs on click", () => {
    render(
      <PromptTabs
        portcoSlug="test"
        tabs={defaultTabs}
        legacyVersions={[]}
        isAdmin={true}
      />
    );
    fireEvent.click(screen.getByText("Scoring"));
    // Both editors are still rendered (one hidden via className)
    expect(screen.getByTestId("prompt-editor-score")).toBeInTheDocument();
  });

  it("shows legacy tab when versions exist", () => {
    render(
      <PromptTabs
        portcoSlug="test"
        tabs={defaultTabs}
        legacyVersions={legacyVersions}
        isAdmin={true}
      />
    );
    expect(screen.getByText("Legacy (1)")).toBeInTheDocument();
  });

  it("renders legacy versions when tab is selected", () => {
    render(
      <PromptTabs
        portcoSlug="test"
        tabs={defaultTabs}
        legacyVersions={legacyVersions}
        isAdmin={true}
      />
    );
    fireEvent.click(screen.getByText("Legacy (1)"));
    expect(screen.getByText("v1")).toBeInTheDocument();
    expect(screen.getByText("Legacy")).toBeInTheDocument();
    expect(screen.getByText("— Initial version")).toBeInTheDocument();
  });
});
