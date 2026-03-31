/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { OrgChart } from "./org-chart";

function buildNode(overrides: Partial<Parameters<typeof OrgChart>[0]["roots"][0]> = {}) {
  return {
    id: "node-1",
    name: "Tanaka Taro",
    title: "CEO",
    department: "Executive",
    role: "executive",
    children: [],
    ...overrides,
  };
}

describe("OrgChart", () => {
  it("renders empty state when no roots or orphans", () => {
    render(<OrgChart roots={[]} orphans={[]} />);
    expect(screen.getByText(/no organizational structure/i)).toBeInTheDocument();
  });

  it("renders root node with name, title, and department", () => {
    const root = buildNode();
    render(<OrgChart roots={[root]} orphans={[]} />);

    expect(screen.getByText("Tanaka Taro")).toBeInTheDocument();
    expect(screen.getByText("CEO")).toBeInTheDocument();
    expect(screen.getByText("Executive")).toBeInTheDocument();
    expect(screen.getByText("executive")).toBeInTheDocument();
  });

  it("renders orphans in grid with 'Other Personnel' heading", () => {
    const orphan = buildNode({ id: "orphan-1", name: "Suzuki Hanako", title: "Engineer", role: null });
    render(<OrgChart roots={[]} orphans={[orphan]} />);

    expect(screen.getByText("Other Personnel")).toBeInTheDocument();
    expect(screen.getByText("Suzuki Hanako")).toBeInTheDocument();
    expect(screen.getByText("Engineer")).toBeInTheDocument();
  });

  it("renders children recursively", () => {
    const child = buildNode({ id: "child-1", name: "Yamada Jiro", title: "CTO" });
    const root = buildNode({ children: [child] });
    render(<OrgChart roots={[root]} orphans={[]} />);

    expect(screen.getByText("Tanaka Taro")).toBeInTheDocument();
    expect(screen.getByText("Yamada Jiro")).toBeInTheDocument();
  });

  it("hides title when null", () => {
    const root = buildNode({ title: null });
    render(<OrgChart roots={[root]} orphans={[]} />);

    expect(screen.getByText("Tanaka Taro")).toBeInTheDocument();
    expect(screen.queryByText("CEO")).not.toBeInTheDocument();
  });

  it("hides department and role badges when null", () => {
    const root = buildNode({ department: null, role: null });
    render(<OrgChart roots={[root]} orphans={[]} />);

    expect(screen.queryByText("Executive")).not.toBeInTheDocument();
    expect(screen.queryByText("executive")).not.toBeInTheDocument();
  });

  it("renders both roots and orphans together", () => {
    const root = buildNode();
    const orphan = buildNode({ id: "orphan-1", name: "Orphan Person" });
    render(<OrgChart roots={[root]} orphans={[orphan]} />);

    expect(screen.getByText("Tanaka Taro")).toBeInTheDocument();
    expect(screen.getByText("Orphan Person")).toBeInTheDocument();
    expect(screen.getByText("Other Personnel")).toBeInTheDocument();
  });
});
