import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { ApprovalState } from "@/store/agentStore";
import { useAgentStore } from "@/store/agentStore";
import { Flow } from "./Flow";

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
      expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString()
    }
  };
}

describe("Flow approval placement", () => {
  beforeEach(() => {
    useAgentStore.setState({
      status: "WAITING_APPROVAL",
      activeSessionId: "session-1",
      submittedPrompt: "修改 HelloWorld.java",
      events: [],
      steps: [{ step: 1, thought: "准备修改文件", tool: "replace_in_file", status: "blocked" }],
      approvals: { "approval-pending": makeApproval("pending") },
      answer: undefined,
      error: undefined,
      runHistory: [],
      trace: []
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("renders pending approvals after the agent process", () => {
    render(<Flow />);

    const processHeading = screen.getByText("Agent 执行过程");
    const approvalText = screen.getByText(/即将写入 src\/App\.tsx/);

    expect(processHeading.compareDocumentPosition(approvalText) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("does not render resolved approvals in the conversation", () => {
    useAgentStore.setState({
      approvals: { "approval-approved": makeApproval("approved") }
    });

    render(<Flow />);

    expect(screen.queryByText(/已批准/)).not.toBeInTheDocument();
    expect(screen.queryByText(/即将写入 src\/App\.tsx/)).not.toBeInTheDocument();
  });
});
