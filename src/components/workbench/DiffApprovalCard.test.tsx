import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ApprovalState } from "@/store/agentStore";
import { useAgentStore } from "@/store/agentStore";
import { DiffApprovalCard } from "./DiffApprovalCard";

afterEach(() => {
  cleanup();
});

function makeApproval(status: ApprovalState["status"]): ApprovalState {
  return {
    approvalId: `approval-${status}`,
    status,
    event: {
      type: "approval_required",
      step: 1,
      tool: "replace_in_file",
      input: { path: "src/App.tsx" },
      approvalId: `approval-${status}`,
      permissionLevel: "WRITE_CONFIRM",
      riskReason: "文件替换会修改工作区内容，需要人工确认",
      operationPreview: "replace_in_file path=src/App.tsx oldChars=14 newChars=19",
      expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      diff: {
        format: "OLD_NEW",
        path: "src/App.tsx",
        oldText: "const label = 'old';",
        newText: "const label = 'new';",
        editable: false
      }
    }
  };
}

function makeDeleteApproval(status: ApprovalState["status"], secondConfirmation: boolean): ApprovalState {
  return {
    approvalId: `delete-${status}`,
    status,
    event: {
      type: "high_risk_approval_required",
      step: 1,
      tool: "delete_files",
      input: { paths: ["old-module"] },
      approvalId: `delete-${status}`,
      permissionLevel: "HIGH_RISK_CONFIRM",
      riskReason: "文件或目录删除不可恢复，需要高危审批",
      operationPreview: "将递归删除 old-module",
      expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      metadata: {
        deletePreview: {
          targetCount: 1,
          fileCount: 2,
          directoryCount: 1,
          symlinkCount: 1,
          totalBytes: 2048,
          targets: [{ path: "old-module", kind: "DIRECTORY" }],
          samplePaths: ["old-module", "old-module/a.py", "old-module/link"],
          truncated: false,
          riskFlags: ["RECURSIVE", "UNDO_MAY_BE_UNAVAILABLE"],
          requiresSecondConfirmation: secondConfirmation
        }
      }
    }
  };
}

describe("DiffApprovalCard", () => {
  it("shows approval action buttons while pending", () => {
    render(<DiffApprovalCard approval={makeApproval("pending")} />);

    expect(screen.getByRole("button", { name: /拒绝/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /批准/ })).toBeInTheDocument();
    expect(screen.getByText(/即将写入 src\/App\.tsx/)).toBeInTheDocument();
  });

  it("shows a green approved result without action buttons", () => {
    render(<DiffApprovalCard approval={makeApproval("approved")} />);

    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("已批准 · 已写入 App.tsx");
    expect(status).toHaveClass("border-emerald-500/40");
    expect(screen.queryByRole("button", { name: /拒绝/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /批准/ })).not.toBeInTheDocument();
  });

  it("shows a red rejected result without action buttons", () => {
    render(<DiffApprovalCard approval={makeApproval("rejected")} />);

    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("已拒绝 · 未写入 App.tsx");
    expect(status).toHaveClass("border-red-500/40");
    expect(screen.queryByRole("button", { name: /拒绝/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /批准/ })).not.toBeInTheDocument();
  });

  it("shows structured recursive deletion impact", () => {
    render(<DiffApprovalCard approval={makeDeleteApproval("pending", true)} />);

    expect(screen.getAllByText("old-module").length).toBeGreaterThan(0);
    expect(screen.getByText("2 文件")).toBeInTheDocument();
    expect(screen.getByText("1 目录")).toBeInTheDocument();
    expect(screen.getByText(/一键撤销不保证完整恢复/)).toBeInTheDocument();
  });

  it("requires a second confirmation for recursive deletion", () => {
    render(<DiffApprovalCard approval={makeDeleteApproval("pending", true)} />);

    fireEvent.click(screen.getByRole("button", { name: "批准删除" }));

    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    expect(screen.getByText("最后确认删除")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "确认删除" })).toBeInTheDocument();
  });

  it("approves a single file without opening the second dialog", () => {
    const originalDecide = useAgentStore.getState().decide;
    const decide = vi.fn().mockResolvedValue(undefined);
    useAgentStore.setState({ decide });
    const approval = makeDeleteApproval("pending", false);
    approval.event.metadata!.deletePreview = {
      ...approval.event.metadata!.deletePreview!,
      directoryCount: 0,
      targets: [{ path: "old.py", kind: "FILE" }],
      samplePaths: ["old.py"]
    };
    render(<DiffApprovalCard approval={approval} />);

    fireEvent.click(screen.getByRole("button", { name: "批准删除" }));

    expect(decide).toHaveBeenCalledWith("delete-pending", "APPROVE");
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    useAgentStore.setState({ decide: originalDecide });
  });

  it("does not claim deletion completed immediately after approval", () => {
    render(<DiffApprovalCard approval={makeDeleteApproval("approved", false)} />);

    expect(screen.getByRole("status")).toHaveTextContent("已批准 · 等待执行删除");
  });

  it("shows deletion completed only after execution", () => {
    render(<DiffApprovalCard approval={makeDeleteApproval("executed", false)} />);

    expect(screen.getByRole("status")).toHaveTextContent("删除完成");
  });
});
