import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { ApprovalState } from "@/store/agentStore";
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
});
