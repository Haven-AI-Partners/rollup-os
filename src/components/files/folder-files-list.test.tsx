/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { FolderFilesList, buildFolderTree, collectDescendantPaths } from "./folder-files-list";
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
        hasMore={false}
        isFetching={false}
        onLoadMore={() => {}}
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
        hasMore={false}
        isFetching={false}
        onLoadMore={() => {}}
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
        hasMore={false}
        isFetching={false}
        onLoadMore={() => {}}
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
        hasMore={false}
        isFetching={false}
        onLoadMore={() => {}}
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
        hasMore={false}
        isFetching={false}
        onLoadMore={() => {}}
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

  it("expands all subfolders within a folder when expand-all button is clicked", () => {
    const files = [
      makeFile({ id: "f1", name: "Deep.pdf", parentPath: "A/B/C" }),
      makeFile({ id: "f2", name: "Mid.pdf", parentPath: "A/B" }),
    ];

    render(
      <FolderFilesList
        files={files}
        processedMap={{}}
        portcoSlug="test-co"
        isAdmin={false}
        hasMore={false}
        isFetching={false}
        onLoadMore={() => {}}
      />,
    );

    // A is auto-expanded, B is visible but not expanded
    expect(screen.getByTestId("folder-A/B")).toBeInTheDocument();
    expect(screen.queryByText("Deep.pdf")).not.toBeInTheDocument();

    // Click expand-all on folder A
    fireEvent.click(screen.getByTestId("folder-expand-all-A"));

    // Now B and C should be expanded, showing Deep.pdf
    expect(screen.getByText("Deep.pdf")).toBeInTheDocument();
    expect(screen.getByText("Mid.pdf")).toBeInTheDocument();
  });

  it("collapses all subfolders when collapse-all button is clicked on an expanded folder", () => {
    const files = [
      makeFile({ id: "f1", name: "Deep.pdf", parentPath: "A/B/C" }),
    ];

    render(
      <FolderFilesList
        files={files}
        processedMap={{}}
        portcoSlug="test-co"
        isAdmin={false}
        hasMore={false}
        isFetching={false}
        onLoadMore={() => {}}
      />,
    );

    // Expand all subfolders of A first
    fireEvent.click(screen.getByTestId("folder-expand-all-A"));
    expect(screen.getByText("Deep.pdf")).toBeInTheDocument();

    // Now collapse all subfolders of A (button toggles to collapse)
    fireEvent.click(screen.getByTestId("folder-expand-all-A"));

    // A should still be expanded (showing B), but B/C should be collapsed
    expect(screen.getByTestId("folder-A/B")).toBeInTheDocument();
    expect(screen.queryByText("Deep.pdf")).not.toBeInTheDocument();
  });

  it("global expand all expands every folder", () => {
    const files = [
      makeFile({ id: "f1", name: "Deep.pdf", parentPath: "A/B/C" }),
      makeFile({ id: "f2", name: "Other.pdf", parentPath: "X/Y" }),
    ];

    render(
      <FolderFilesList
        files={files}
        processedMap={{}}
        portcoSlug="test-co"
        isAdmin={false}
        hasMore={false}
        isFetching={false}
        onLoadMore={() => {}}
      />,
    );

    // Deep files not visible yet
    expect(screen.queryByText("Deep.pdf")).not.toBeInTheDocument();
    expect(screen.queryByText("Other.pdf")).not.toBeInTheDocument();

    // Click global expand all
    fireEvent.click(screen.getByTestId("global-expand-toggle"));

    // All files should now be visible
    expect(screen.getByText("Deep.pdf")).toBeInTheDocument();
    expect(screen.getByText("Other.pdf")).toBeInTheDocument();
  });

  it("global collapse all collapses every folder", () => {
    const files = [
      makeFile({ id: "f1", name: "File.pdf", parentPath: "A" }),
      makeFile({ id: "f2", name: "File2.pdf", parentPath: "B" }),
    ];

    render(
      <FolderFilesList
        files={files}
        processedMap={{}}
        portcoSlug="test-co"
        isAdmin={false}
        hasMore={false}
        isFetching={false}
        onLoadMore={() => {}}
      />,
    );

    // Top-level auto-expanded, files visible
    expect(screen.getByText("File.pdf")).toBeInTheDocument();
    expect(screen.getByText("File2.pdf")).toBeInTheDocument();

    // Click global collapse all
    fireEvent.click(screen.getByTestId("global-expand-toggle"));

    // Files should be hidden
    expect(screen.queryByText("File.pdf")).not.toBeInTheDocument();
    expect(screen.queryByText("File2.pdf")).not.toBeInTheDocument();
  });
});

describe("collectDescendantPaths", () => {
  it("collects all nested folder paths", () => {
    const files = [
      makeFile({ id: "f1", parentPath: "A/B/C" }),
      makeFile({ id: "f2", parentPath: "A/D" }),
    ];
    const tree = buildFolderTree(files);
    const paths = collectDescendantPaths(tree);
    expect(paths).toEqual(expect.arrayContaining(["A", "A/B", "A/B/C", "A/D"]));
    expect(paths).toHaveLength(4);
  });

  it("returns empty array for root with no children", () => {
    const tree = buildFolderTree([]);
    const paths = collectDescendantPaths(tree);
    expect(paths).toHaveLength(0);
  });
});
