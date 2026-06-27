import { beforeEach, afterEach, describe, expect, it } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { useAgentStore } from "@/store/agentStore";
import { UndoConfirmDialog } from "@/components/workbench/UndoConfirmDialog";

describe("UndoConfirmDialog", () => {
  beforeEach(() => {
    useAgentStore.setState({
      undoByRunId: {},
      undoDialogRunId: undefined
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("does not render content when dialog is closed", () => {
    render(<UndoConfirmDialog />);
    expect(screen.queryByText("撤销本轮修改？")).toBeNull();
  });

  it("renders dialog content when dialog runId is set with response", () => {
    useAgentStore.setState({
      undoDialogRunId: "run-1",
      undoByRunId: {
        "run-1": {
          loading: false,
          executing: false,
          response: {
            runId: "run-1",
            status: "READY" as const,
            canUndo: true,
            snapshotVersion: 1,
            changedFiles: [
              { path: "src/a.ts", changeType: "MODIFIED" as const },
              { path: "src/b.ts", changeType: "ADDED" as const }
            ],
            changedFileCount: 2,
            changedBytes: 1024
          }
        }
      }
    });

    render(<UndoConfirmDialog />);

    expect(screen.getByText("撤销本轮修改？")).toBeDefined();
    expect(screen.getByText("保留修改")).toBeDefined();
    expect(screen.getByText("确认撤销")).toBeDefined();
    expect(screen.getByText("共 2 个文件")).toBeDefined();
  });

  it("shows overflow count when more than 8 files", () => {
    const files = Array.from({ length: 12 }, (_, i) => ({
      path: `src/file${i}.ts`,
      changeType: "MODIFIED" as const
    }));

    useAgentStore.setState({
      undoDialogRunId: "run-2",
      undoByRunId: {
        "run-2": {
          loading: false,
          executing: false,
          response: {
            runId: "run-2",
            status: "READY" as const,
            canUndo: true,
            snapshotVersion: 2,
            changedFiles: files,
            changedFileCount: 12
          }
        }
      }
    });

    render(<UndoConfirmDialog />);
    const overflowEls = screen.getAllByText("另有 4 个文件");
    expect(overflowEls.length).toBeGreaterThan(0);
    expect(overflowEls[overflowEls.length - 1]).toBeDefined();
  });

  it("disables buttons when executing", () => {
    useAgentStore.setState({
      undoDialogRunId: "run-3",
      undoByRunId: {
        "run-3": {
          loading: false,
          executing: true,
          response: {
            runId: "run-3",
            status: "READY" as const,
            canUndo: true,
            snapshotVersion: 3,
            changedFiles: [],
            changedFileCount: 0
          }
        }
      }
    });

    render(<UndoConfirmDialog />);

    const cancelBtns = screen.getAllByText("保留修改");
    const confirmBtns = screen.getAllByText("正在撤销");
    const lastCancel = cancelBtns[cancelBtns.length - 1]?.closest("button");
    const lastConfirm = confirmBtns[confirmBtns.length - 1]?.closest("button");
    expect(lastCancel?.disabled).toBe(true);
    expect(lastConfirm?.disabled).toBe(true);
  });
});
