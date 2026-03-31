/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { GdriveSettings } from "./gdrive-settings";

vi.mock("@/lib/actions/settings", () => ({
  updateGdriveFolderId: vi.fn().mockResolvedValue(undefined),
  disconnectGdrive: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/format", () => ({
  formatRelativeTime: vi.fn().mockReturnValue("2 hours ago"),
}));

describe("GdriveSettings", () => {
  it("renders disconnected state", () => {
    render(
      <GdriveSettings
        portcoSlug="test-portco"
        isConnected={false}
        folderId={null}
        folderName={null}
        accountEmail={null}
        accountName={null}
      />
    );

    expect(screen.getByText("Google Drive")).toBeInTheDocument();
    expect(screen.getByText("Not connected")).toBeInTheDocument();
    expect(screen.getByText("Connect Google Drive")).toBeInTheDocument();
  });

  it("renders connected state", () => {
    render(
      <GdriveSettings
        portcoSlug="test-portco"
        isConnected={true}
        folderId="folder-123"
        folderName="Deal Documents"
        accountEmail="user@example.com"
        accountName="Test User"
      />
    );

    expect(screen.getByText("Google Drive")).toBeInTheDocument();
    expect(screen.getByText("Connected")).toBeInTheDocument();
    expect(screen.getByText("Test User")).toBeInTheDocument();
    expect(screen.getByText("user@example.com")).toBeInTheDocument();
    expect(screen.getByText("Deal Documents")).toBeInTheDocument();
    expect(screen.getByText("Disconnect")).toBeInTheDocument();
  });

  it("renders description text", () => {
    render(
      <GdriveSettings
        portcoSlug="test-portco"
        isConnected={false}
        folderId={null}
        folderName={null}
        accountEmail={null}
        accountName={null}
      />
    );

    expect(screen.getByText("Connect Google Drive to browse and process IMs")).toBeInTheDocument();
  });
});
