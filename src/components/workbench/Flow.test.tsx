import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ApprovalState } from "@/store/agentStore";
import { useAgentStore } from "@/store/agentStore";
import { Flow } from "./Flow";
import { RightRail } from "./RightRail";

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
      recoverable: false,
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

describe("Flow new status states", () => {
  beforeEach(() => {
    useAgentStore.setState({
      activeSessionId: "session-1",
      submittedPrompt: "task",
      events: [],
      steps: [],
      approvals: {},
      answer: undefined,
      error: undefined,
      recoverable: false,
      runHistory: [],
      trace: []
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("shows a disconnected banner with a recovery action", () => {
    useAgentStore.setState({ status: "DISCONNECTED", runId: "run-x", recoverable: true });
    const reconcile = vi.fn().mockResolvedValue(undefined);
    useAgentStore.setState({ reconcileRunStatus: reconcile });
    render(<Flow />);

    expect(screen.getByText("连接已断开")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "重新连接" }));
    expect(reconcile).toHaveBeenCalledWith("run-x");
  });

  it("shows a waiting-for-user-input indicator", () => {
    useAgentStore.setState({ status: "WAITING_USER_INPUT" });
    render(<Flow />);

    expect(screen.getByText("等待用户输入")).toBeInTheDocument();
  });

  it("marks recoverable errors and offers a recovery action", () => {
    useAgentStore.setState({
      status: "ERROR",
      error: "transient failure",
      recoverable: true,
      runId: "run-y"
    });
    const reconcile = vi.fn().mockResolvedValue(undefined);
    useAgentStore.setState({ reconcileRunStatus: reconcile });
    render(<Flow />);

    expect(screen.getByText("可恢复")).toBeInTheDocument();
    expect(screen.getByText("transient failure")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "恢复运行" }));
    expect(reconcile).toHaveBeenCalledWith("run-y");
  });

  it("surfaces the FAILED terminal status with its own copy", () => {
    useAgentStore.setState({ status: "FAILED", error: "tool chain aborted" });
    render(<Flow />);

    expect(screen.getByText("运行失败")).toBeInTheDocument();
    expect(screen.getByText("tool chain aborted")).toBeInTheDocument();
  });

  it("surfaces the BUDGET_EXCEEDED terminal status", () => {
    useAgentStore.setState({ status: "BUDGET_EXCEEDED", error: "out of tokens" });
    render(<Flow />);

    expect(screen.getByText("预算已耗尽")).toBeInTheDocument();
  });
});

describe("Flow usage summaries", () => {
  beforeEach(() => {
    useAgentStore.setState({
      status: "IDLE",
      activeSessionId: "session-usage",
      submittedPrompt: undefined,
      events: [],
      steps: [],
      approvals: {},
      answer: undefined,
      error: undefined,
      recoverable: false,
      trace: [],
      runHistory: [
        {
          id: "h1",
          prompt: "first",
          createdAt: "2026-07-07T00:00:00.000Z",
          updatedAt: "2026-07-07T00:00:00.000Z",
          runId: "run-1",
          answer: "first answer"
        },
        {
          id: "h2",
          prompt: "second",
          createdAt: "2026-07-07T00:01:00.000Z",
          updatedAt: "2026-07-07T00:01:00.000Z",
          runId: "run-2",
          answer: "second answer"
        }
      ],
      usageByRunId: {
        "run-1": { runId: "run-1", totalTokens: 190290, cacheHitRate: 0.903 },
        "run-2": { runId: "run-2", totalTokens: 120916, cacheHitRate: 0.902 }
      }
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("renders each history run with its own run-scoped token usage", () => {
    render(<Flow />);

    expect(screen.getByText("本轮 tokens 190,290")).toBeInTheDocument();
    expect(screen.getByText("本轮 tokens 120,916")).toBeInTheDocument();
  });
});

describe("RightRail plan display", () => {
  beforeEach(() => {
    useAgentStore.setState({
      planTriggered: true,
      plan: [
        { id: "skipped-duplicate", title: "审查项目所有关键文件内容，了解实际代码和文档情况", status: "skipped" },
        { id: "done-item", title: "删除旧的 README.md 文件", status: "done" },
        { id: "pending-item", title: "给出包含证据和结果的最终答复", status: "pending" }
      ],
      trace: [],
      runId: undefined,
      undoByRunId: {},
      backgroundTasks: []
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("hides skipped plan items from the active execution plan", () => {
    render(<RightRail open />);

    expect(screen.queryByText("审查项目所有关键文件内容，了解实际代码和文档情况")).not.toBeInTheDocument();
    expect(screen.getByText("删除旧的 README.md 文件")).toBeInTheDocument();
    expect(screen.getByText("给出包含证据和结果的最终答复")).toBeInTheDocument();
    expect(screen.getByText("1/2")).toBeInTheDocument();
  });
});
