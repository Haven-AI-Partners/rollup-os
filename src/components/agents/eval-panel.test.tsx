/** @vitest-environment jsdom */
import { describe, it, expect, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { EvalPanel } from "./eval-panel";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

vi.mock("@/lib/actions/im-processing", () => ({
  triggerEvalRun: vi.fn(),
}));

vi.mock("@/hooks/use-run-status", () => ({
  useRunStatus: () => ({ state: null }),
}));

vi.mock("@/components/ui/button", () => ({
  Button: (props: React.ButtonHTMLAttributes<HTMLButtonElement> & { children: React.ReactNode }) => (
    <button {...props}>{props.children}</button>
  ),
}));

vi.mock("@/components/ui/card", () => ({
  Card: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
  CardHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardTitle: ({ children }: { children: React.ReactNode }) => <h3>{children}</h3>,
}));

vi.mock("@/components/ui/badge", () => ({
  Badge: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));

vi.mock("@/components/ui/select", () => ({
  Select: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectValue: () => <span />,
}));

vi.mock("@/lib/scoring/rubric", () => ({
  SCORING_DIMENSIONS: [
    { id: "revenue", name: "Revenue Quality" },
    { id: "profitability", name: "Profitability" },
  ],
}));

vi.mock("@/lib/constants", () => ({
  stdDevBadgeColor: () => "text-green-700",
  flagAgreementBadgeColor: () => "text-green-700",
}));

vi.mock("@/lib/format", () => ({
  formatDateTime: () => "2024-01-01 12:00",
  formatDuration: () => "2m 30s",
}));

vi.mock("lucide-react", () => ({
  FlaskConical: () => <svg data-testid="flask-icon" />,
  CheckCircle: () => <svg />,
  XCircle: () => <svg />,
  Loader2: () => <svg />,
  TrendingDown: () => <svg />,
  TrendingUp: () => <svg />,
  Minus: () => <svg />,
  ChevronRight: () => <svg />,
  Clock: () => <svg />,
}));

describe("EvalPanel", () => {
  const baseProps = {
    portcoSlug: "test-portco",
    processedFiles: [],
    isAdmin: true,
  };

  it("renders panel heading", () => {
    render(<EvalPanel {...baseProps} evalRuns={[]} />);
    expect(screen.getByText("Consistency Evals")).toBeInTheDocument();
  });

  it("renders empty state when no eval runs", () => {
    render(<EvalPanel {...baseProps} evalRuns={[]} />);
    expect(
      screen.getByText(
        "No evals run yet. Select a processed file above to measure consistency."
      )
    ).toBeInTheDocument();
  });

  it("renders eval run entries", () => {
    const evalRuns = [
      {
        id: "run-1",
        fileName: "test-file.pdf",
        iterations: 3,
        status: "completed",
        overallScoreStdDev: "0.12",
        flagAgreementRate: "0.85",
        nameConsistent: "Consistent",
        scoreVariance: null,
        promptVersionLabel: "v1",
        modelId: "gpt-4",
        createdAt: "2024-01-01T00:00:00Z",
        completedAt: "2024-01-01T00:02:30Z",
      },
    ];
    render(<EvalPanel {...baseProps} evalRuns={evalRuns} />);
    expect(screen.getByText("test-file.pdf")).toBeInTheDocument();
  });
});
