import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Sidebar } from "./Sidebar";
import { useAgentStore } from "@/store/agentStore";

describe("Sidebar", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    useAgentStore.setState({
      activeSessionId: "running",
      sessions: [
        {
          id: "running",
          title: "运行任务",
          createdAt: "2026-07-01T00:00:00.000Z",
          updatedAt: "2026-07-01T00:00:00.000Z",
          status: "RUNNING"
        },
        {
          id: "completed",
          title: "完成任务",
          createdAt: "2026-07-01T00:00:00.000Z",
          updatedAt: "2026-07-01T00:00:00.000Z",
          status: "COMPLETED"
        },
        {
          id: "failed",
          title: "失败任务",
          createdAt: "2026-07-01T00:00:00.000Z",
          updatedAt: "2026-07-01T00:00:00.000Z",
          status: "ERROR"
        }
      ],
      streams: {},
      workspace: "",
      workspaceTree: undefined,
      recentFiles: []
    });
  });

  it("shows a status for every session", () => {
    render(<Sidebar open />);

    expect(screen.getByText("运行中")).toBeInTheDocument();
    expect(screen.getByText("已完成")).toBeInTheDocument();
    expect(screen.getByText("失败")).toBeInTheDocument();
  });

  it("confirms and deletes the requested session", () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<Sidebar open />);

    fireEvent.click(screen.getByRole("button", { name: "删除会话：完成任务" }));

    expect(window.confirm).toHaveBeenCalled();
    expect(useAgentStore.getState().sessions.map((session) => session.id)).toEqual(["running", "failed"]);
  });

  it("gives the file area its own vertical scroll region", () => {
    render(<Sidebar open />);

    expect(screen.getByTestId("file-scroll-region")).toHaveClass("flex-1", "overflow-y-auto");
  });
});
