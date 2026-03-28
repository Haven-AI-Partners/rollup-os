/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { FolderFilesList, buildFolderTree } from "./folder-files-list";
import type { GDriveFile } from "./virtual-files-list";

vi.mock("@/components/deals/process-gdrive-file-button", () => ({
  ProcessGdriveFileButton: () => <button>Import &amp; Process</button>,
}));

function makeFile(overrides: Partial<GDriveFile> = {}): GDriveFile {
  return {
    id: "file-1",
    name: "Test File.pdf",
    mimeType: "application/pdf",
    size: "1024",
    modifiedTime: "2024-06-15T10:00:00Z",
    webViewLink: "https://drive.google.com/file/1",
    parentPath: "",
    ...overrides,
  };
}

describe("buildFolderTree", () => {
  it("places files with empty parentPath at root", () => {
    const files = [makeFile({ id: "f1", parentPath: "" })];
    const tree = buildFolderTree(files);
    expect(tree.files).toHaveLength(1);
    expect(tree.children.size).toBe(0);
  });

  it("creates nested folders from parentPath", () => {
    const files = [
      makeFile({ id: "f1", parentPath: "IMs/CompanyA" }),
    ];
    const tree = buildFolderTree(files);
    expect(tree.children.has("IMs")).toBe(true);
    const ims = tree.children.get("IMs")!;
    expect(ims.children.has("CompanyA")).toBe(true);
    expect(ims.children.get("CompanyA")!.files).toHaveLength(1);
  });

  it("groups files in the same folder", () => {
    const files = [
      makeFile({ id: "f1", parentPath: "IMs" }),
      makeFile({ id: "f2", parentPath: "IMs" }),
    ];
    const tree = buildFolderTree(files);
    expect(tree.children.get("IMs")!.files).toHaveLength(2);
  });

  it("creates separate branches for different paths", () => {
    const files = [
      makeFile({ id: "f1", parentPath: "IMs" }),
      makeFile({ id: "f2", parentPath: "Deals" }),
    ];
    const tree = buildFolderTree(files);
    expect(tree.children.size).toBe(2);
    expect(tree.children.has("IMs")).toBe(true);
    expect(tree.children.has("Deals")).toBe(true);
  });
});

describe("FolderFilesList", () => {
  it("renders folder structure with files", () => {
    const files = [
      makeFile({ id: "f1", name: "IM.pdf", parentPath: "IMs" }),
      makeFile({ id: "f2", name: "NDA.pdf", parentPath: "Deals" }),
    ];

    render(
      <FolderFilesList
        files={files}
        processedMap={{}}
        portcoSlug="test-co"
        isAdmin={false}
      />,
    );

    // Folders should be visible
    expect(screen.getByText("IMs")).toBeInTheDocument();
    expect(screen.getByText("Deals")).toBeInTheDocument();
    // Top-level folders auto-expand, so files should be visible
    expect(screen.getByText("IM.pdf")).toBeInTheDocument();
    expect(screen.getByText("NDA.pdf")).toBeInTheDocument();
  });

  it("shows file count on folders", () => {
    const files = [
      makeFile({ id: "f1", parentPath: "IMs" }),
      makeFile({ id: "f2", parentPath: "IMs" }),
      makeFile({ id: "f3", parentPath: "IMs/Sub" }),
    ];

    render(
      <FolderFilesList
        files={files}
        processedMap={{}}
        portcoSlug="test-co"
        isAdmin={false}
      />,
    );

    // IMs folder should show count of 3 (2 direct + 1 in subfolder)
    const imsFolder = screen.getByTestId("folder-IMs");
    expect(imsFolder).toHaveTextContent("3");
  });

  it("collapses and expands folders on click", () => {
    const files = [
      makeFile({ id: "f1", name: "IM.pdf", parentPath: "IMs" }),
    ];

    render(
      <FolderFilesList
        files={files}
        processedMap={{}}
        portcoSlug="test-co"
        isAdmin={false}
      />,
    );

    // File visible by default (top-level auto-expanded)
    expect(screen.getByText("IM.pdf")).toBeInTheDocument();

    // Collapse
    fireEvent.click(screen.getByTestId("folder-IMs"));
    expect(screen.queryByText("IM.pdf")).not.toBeInTheDocument();

    // Expand again
    fireEvent.click(screen.getByTestId("folder-IMs"));
    expect(screen.getByText("IM.pdf")).toBeInTheDocument();
  });

  it("renders root-level files outside folders", () => {
    const files = [
      makeFile({ id: "f1", name: "Root.pdf", parentPath: "" }),
      makeFile({ id: "f2", name: "IM.pdf", parentPath: "IMs" }),
    ];

    render(
      <FolderFilesList
        files={files}
        processedMap={{}}
        portcoSlug="test-co"
        isAdmin={false}
      />,
    );

    expect(screen.getByText("Root.pdf")).toBeInTheDocument();
    expect(screen.getByText("IM.pdf")).toBeInTheDocument();
  });

  it("renders deeply nested folder structure", () => {
    const files = [
      makeFile({ id: "f1", name: "Deep.pdf", parentPath: "A/B/C" }),
    ];

    render(
      <FolderFilesList
        files={files}
        processedMap={{}}
        portcoSlug="test-co"
        isAdmin={false}
      />,
    );

    expect(screen.getByText("A")).toBeInTheDocument();
    // A is auto-expanded, but B and C are not top-level so not auto-expanded
    // B should be visible as child of A
    expect(screen.getByTestId("folder-A/B")).toBeInTheDocument();

    // Expand B
    fireEvent.click(screen.getByTestId("folder-A/B"));
    expect(screen.getByTestId("folder-A/B/C")).toBeInTheDocument();

    // Expand C
    fireEvent.click(screen.getByTestId("folder-A/B/C"));
    expect(screen.getByText("Deep.pdf")).toBeInTheDocument();
  });
});
