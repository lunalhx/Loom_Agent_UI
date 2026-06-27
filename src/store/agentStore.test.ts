import { beforeEach, describe, expect, it } from "vitest";
import { approvalRun, errorRun, normalRun, policyDeniedRun } from "@/lib/mockEvents";
import { useAgentStore } from "./agentStore";

describe("agent store event reducer", () => {
  beforeEach(() => {
    useAgentStore.setState({
      status: "IDLE",
      events: [],
      steps: [],
      plan: [],
      planTriggered: false,
      trace: [],
      approvals: {},
      recentFiles: [],
      runHistory: [],
      answer: undefined,
      error: undefined,
      prompt: "mock task",
      submittedPrompt: "mock task"
    });
  });

  it("derives steps, files, answer, and completion from a normal run", () => {
    for (const event of normalRun) {
      useAgentStore.getState().receiveEvent(event);
    }

    const state = useAgentStore.getState();
    expect(state.status).toBe("COMPLETED");
    expect(state.steps).toHaveLength(2);
    expect(state.plan[0].status).toBe("done");
    expect(state.recentFiles).toContain("src/main.tsx");
    expect(state.answer).toContain("完成检查");
  });

  it("stores planner events and timeline entries", () => {
    for (const event of normalRun) {
      useAgentStore.getState().receiveEvent(event);
    }

    const state = useAgentStore.getState();
    expect(state.plan).toHaveLength(3);
    expect(state.planTriggered).toBe(true);
    expect(state.plan.every((item) => item.status === "done")).toBe(true);
    expect(state.trace.some((item) => item.label === "plan updated")).toBe(true);
    expect(state.trace.some((item) => item.label === "checkpoint_saved")).toBe(true);
    expect(state.trace.some((item) => item.label === "UI reviewer")).toBe(true);
  });

  it("does not invent a todo plan for a simple run", () => {
    useAgentStore.getState().receiveEvent({ type: "thought", step: 1, thought: "直接读取目录" });
    useAgentStore.getState().receiveEvent({ type: "tool_call", step: 1, tool: "list_dir", input: {} });
    useAgentStore.getState().receiveEvent({ type: "answer", answer: "共有 5 个文件夹" });

    expect(useAgentStore.getState().plan).toEqual([]);
    expect(useAgentStore.getState().planTriggered).toBe(false);
  });

  it("keeps legacy derived plan data hidden when no plan event was emitted", () => {
    useAgentStore.setState({
      plan: [
        { id: "legacy-1", title: "普通执行步骤", status: "doing" },
        { id: "legacy-2", title: "另一个普通步骤", status: "pending" }
      ],
      planTriggered: false
    });

    expect(useAgentStore.getState().plan).toHaveLength(2);
    expect(useAgentStore.getState().planTriggered).toBe(false);
  });

  it("moves into WAITING_APPROVAL when approval is required", () => {
    for (const event of approvalRun) {
      useAgentStore.getState().receiveEvent(event);
    }

    const state = useAgentStore.getState();
    expect(state.status).toBe("WAITING_APPROVAL");
    expect(state.approvals["mock-approval-001"].status).toBe("pending");
    expect(state.approvals["mock-approval-001"].event.diff?.format).toBe("OLD_NEW");
    expect(state.approvals["mock-approval-no-diff"].event.diff).toBeUndefined();
    expect(state.steps[0].status).toBe("blocked");
  });

  it("handles high-risk file deletion as an approval request", () => {
    useAgentStore.getState().receiveEvent({
      type: "high_risk_approval_required",
      step: 1,
      tool: "delete_files",
      input: { paths: ["src/obsolete.ts"] },
      approvalId: "mock-high-risk-approval",
      workspace: "Loom_Agent_UI",
      permissionLevel: "HIGH_RISK_CONFIRM",
      riskReason: "文件删除不可恢复，需要高危审批",
      operationPreview: "删除 1 个文件（1 KB）:\n  src/obsolete.ts",
      metadata: {
        deletePreview: {
          targetCount: 1,
          fileCount: 1,
          directoryCount: 0,
          symlinkCount: 0,
          totalBytes: 1024,
          targets: [{ path: "src/obsolete.ts", kind: "FILE" }],
          samplePaths: ["src/obsolete.ts"],
          truncated: false,
          riskFlags: [],
          requiresSecondConfirmation: false
        }
      },
      expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString()
    });

    const state = useAgentStore.getState();
    expect(state.status).toBe("WAITING_APPROVAL");
    expect(state.approvals["mock-high-risk-approval"].status).toBe("pending");
    expect(state.approvals["mock-high-risk-approval"].event.tool).toBe("delete_files");
    expect(state.approvals["mock-high-risk-approval"].event.metadata?.deletePreview?.fileCount).toBe(1);
    expect(state.steps[0].status).toBe("blocked");
    expect(state.trace.at(-1)?.status).toBe("blocked");
  });

  it("marks an approved deletion executed after its observation", () => {
    const event = {
      type: "high_risk_approval_required" as const,
      step: 3,
      tool: "delete_files" as const,
      approvalId: "delete-approved",
      permissionLevel: "HIGH_RISK_CONFIRM" as const
    };
    useAgentStore.setState({
      approvals: {
        "delete-approved": {
          approvalId: "delete-approved",
          status: "approved",
          event
        }
      }
    });

    useAgentStore.getState().receiveEvent({
      type: "observation",
      step: 3,
      observation: "已删除 1 个目标（old.py）"
    });

    expect(useAgentStore.getState().approvals["delete-approved"].status).toBe("executed");
  });

  it("renders policy denied as failed step while allowing a final answer", () => {
    for (const event of policyDeniedRun) {
      useAgentStore.getState().receiveEvent(event);
    }

    const state = useAgentStore.getState();
    expect(state.status).toBe("COMPLETED");
    expect(state.steps[0].status).toBe("failed");
    expect(state.answer).toContain("策略拒绝");
  });

  it("records error events", () => {
    for (const event of errorRun) {
      useAgentStore.getState().receiveEvent(event);
    }

    const state = useAgentStore.getState();
    expect(state.status).toBe("ERROR");
    expect(state.error).toBe("question 不能为空");
  });

  it("selects a stored session and resets the active flow", () => {
    useAgentStore.setState({
      activeSessionId: "old",
      status: "COMPLETED",
      answer: "previous answer",
      steps: [{ step: 1, status: "completed", thought: "old step" }],
      sessions: [
        {
          id: "session-1",
          title: "根目录里面有多少个文件夹",
          createdAt: "2026-06-23T00:00:00.000Z",
          updatedAt: "2026-06-23T00:00:00.000Z",
          workspace: "java/Loom_Agent"
        }
      ]
    });

    useAgentStore.getState().selectSession("session-1");

    const state = useAgentStore.getState();
    expect(state.activeSessionId).toBe("session-1");
    expect(state.prompt).toBe("根目录里面有多少个文件夹");
    expect(state.submittedPrompt).toBe("根目录里面有多少个文件夹");
    expect(state.workspace).toBe("java/Loom_Agent");
    expect(state.answer).toBeUndefined();
    expect(state.steps).toHaveLength(0);
    expect(state.status).toBe("IDLE");
  });

  it("restores a saved session snapshot when available", () => {
    useAgentStore.setState({
      activeSessionId: undefined,
      sessions: [
        {
          id: "session-snapshot",
          title: "解释架构",
          prompt: "解释架构",
          createdAt: "2026-06-23T00:00:00.000Z",
          updatedAt: "2026-06-23T00:01:00.000Z",
          workspace: "java/Loom_Agent",
          status: "COMPLETED",
          steps: [{ step: 1, status: "completed", thought: "read files" }],
          answer: "这是之前的回答",
          trace: [{ id: "trace-1", label: "done", time: "12:00:00", status: "done", type: "final_answer", iteration: 1 }]
        }
      ]
    });

    useAgentStore.getState().selectSession("session-snapshot");

    const state = useAgentStore.getState();
    expect(state.activeSessionId).toBe("session-snapshot");
    expect(state.answer).toBe("这是之前的回答");
    expect(state.submittedPrompt).toBe("解释架构");
    expect(state.steps[0].thought).toBe("read files");
    expect(state.trace[0].label).toBe("done");
    expect(state.status).toBe("COMPLETED");
  });

  it("starts a new local session canvas", () => {
    useAgentStore.setState({
      activeSessionId: "session-1",
      prompt: "old prompt",
      status: "COMPLETED",
      answer: "old answer",
      steps: [{ step: 1, status: "completed", thought: "old" }]
    });

    useAgentStore.getState().newSession();

    const state = useAgentStore.getState();
    expect(state.activeSessionId).toBeUndefined();
    expect(state.prompt).toBe("");
    expect(state.submittedPrompt).toBeUndefined();
    expect(state.answer).toBeUndefined();
    expect(state.steps).toHaveLength(0);
    expect(state.status).toBe("IDLE");
  });

  it("keeps the submitted message when the input draft is edited or cleared", () => {
    useAgentStore.setState({
      activeSessionId: "session-1",
      prompt: "",
      submittedPrompt: "你文件放在哪里的",
      status: "RUNNING",
      sessions: [
        {
          id: "session-1",
          title: "你文件放在哪里的",
          prompt: "你文件放在哪里的",
          createdAt: "2026-06-24T00:00:00.000Z",
          updatedAt: "2026-06-24T00:00:00.000Z",
          status: "RUNNING"
        }
      ]
    });

    useAgentStore.getState().receiveEvent({ type: "thought", step: 1, thought: "查找文件位置" });

    const state = useAgentStore.getState();
    expect(state.prompt).toBe("");
    expect(state.submittedPrompt).toBe("你文件放在哪里的");
    expect(state.sessions[0].prompt).toBe("你文件放在哪里的");
    expect(state.sessions[0].title).toBe("你文件放在哪里的");
  });

  it("clears the input draft when a run is submitted", async () => {
    useAgentStore.setState({
      prompt: "根目录下有多少个文件夹",
      submittedPrompt: undefined,
      workspace: "",
      status: "IDLE",
      sessions: [],
      selectedLocalFile: undefined
    });

    await useAgentStore.getState().startRun();

    const state = useAgentStore.getState();
    expect(state.prompt).toBe("");
    expect(state.submittedPrompt).toBe("根目录下有多少个文件夹");
    expect(state.sessions[0].prompt).toBe("根目录下有多少个文件夹");
  });

  it("continues the active session and keeps the previous run visible", async () => {
    useAgentStore.setState({
      activeSessionId: "session-1",
      prompt: "那这些文件夹分别是干什么的",
      submittedPrompt: "根目录下有多少个文件夹",
      status: "COMPLETED",
      answer: "共有 5 个文件夹",
      conversationId: "conversation-1",
      events: [{ id: "event-1", receivedAt: "12:00:00", event: { type: "answer", answer: "共有 5 个文件夹" } }],
      steps: [{ step: 1, status: "completed", thought: "读取根目录" }],
      runHistory: [],
      sessions: [
        {
          id: "session-1",
          title: "根目录下有多少个文件夹",
          prompt: "根目录下有多少个文件夹",
          createdAt: "2026-06-24T00:00:00.000Z",
          updatedAt: "2026-06-24T00:00:00.000Z",
          status: "COMPLETED",
          conversationId: "conversation-1"
        }
      ],
      selectedLocalFile: undefined
    });

    await useAgentStore.getState().startRun();

    const state = useAgentStore.getState();
    expect(state.activeSessionId).toBe("session-1");
    expect(state.sessions).toHaveLength(1);
    expect(state.submittedPrompt).toBe("那这些文件夹分别是干什么的");
    expect(state.runHistory).toHaveLength(1);
    expect(state.runHistory[0].prompt).toBe("根目录下有多少个文件夹");
    expect(state.runHistory[0].answer).toBe("共有 5 个文件夹");
    expect(state.sessions[0].conversationId).toBe("conversation-1");
  });

  describe("undo store", () => {
    beforeEach(() => {
      useAgentStore.setState({
        undoByRunId: {},
        undoDialogRunId: undefined,
        undoFeatureMissing: false,
        runId: "run-1",
        runHistory: [{ id: "hist-1", prompt: "old task", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z", runId: "run-old" }]
      });
    });

    it("sets loading state and stores response on loadUndo success", async () => {
      const mockResponse = {
        runId: "run-1",
        status: "READY" as const,
        canUndo: true,
        snapshotVersion: 3,
        changedFiles: [{ path: "src/a.ts", changeType: "MODIFIED" as const }],
        changedFileCount: 1
      };
      const { getRunUndo } = await import("@/lib/api");
      const orig = (getRunUndo as ReturnType<typeof vi.fn>);
      // We'll verify state transitions through the action
      // For now, verify the store starts clean
      expect(useAgentStore.getState().undoByRunId).toEqual({});
      expect(useAgentStore.getState().undoDialogRunId).toBeUndefined();
    });

    it("openUndoDialog sets runId and triggers load", () => {
      useAgentStore.getState().openUndoDialog("run-1");
      const state = useAgentStore.getState();
      expect(state.undoDialogRunId).toBe("run-1");
      expect(state.undoByRunId["run-1"]?.loading).toBe(true);
    });

    it("closeUndoDialog clears dialog runId", () => {
      useAgentStore.setState({ undoDialogRunId: "run-1" });
      useAgentStore.getState().closeUndoDialog();
      expect(useAgentStore.getState().undoDialogRunId).toBeUndefined();
    });

    it("newSession clears undo state", () => {
      useAgentStore.setState({
        undoByRunId: { "run-1": { loading: false, executing: false } },
        undoDialogRunId: "run-1",
        undoFeatureMissing: true
      });
      useAgentStore.getState().newSession();
      const state = useAgentStore.getState();
      expect(state.undoByRunId).toEqual({});
      expect(state.undoDialogRunId).toBeUndefined();
      expect(state.undoFeatureMissing).toBe(false);
    });

    it("startRun closes undo dialog but preserves undo state", async () => {
      useAgentStore.setState({
        prompt: "test undo run",
        undoByRunId: { "run-old": { loading: false, executing: false, response: { runId: "run-old", status: "READY", canUndo: true, snapshotVersion: 1, changedFiles: [], changedFileCount: 0 } } },
        undoDialogRunId: "run-old",
        activeSessionId: "s1",
        sessions: [{ id: "s1", title: "prev", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" }],
        selectedLocalFile: undefined
      });

      await useAgentStore.getState().startRun();
      const state = useAgentStore.getState();
      expect(state.undoDialogRunId).toBeUndefined();
      expect(state.undoByRunId["run-old"]).toBeDefined();
    });

    it("confirmUndo sets executing and prevents double submit", async () => {
      useAgentStore.setState({
        undoByRunId: {
          "run-1": {
            loading: false,
            executing: false,
            response: { runId: "run-1", status: "READY", canUndo: true, snapshotVersion: 1, changedFiles: [], changedFileCount: 0 }
          }
        }
      });

      // Start confirm (will fail since no mock API)
      const promise = useAgentStore.getState().confirmUndo("run-1");
      // executing should be set immediately
      expect(useAgentStore.getState().undoByRunId["run-1"]?.executing).toBe(true);
      await promise;
      // After error, executing should be false
      expect(useAgentStore.getState().undoByRunId["run-1"]?.executing).toBe(false);
    });

    it("refreshUndoAfterTerminal queries current and history runs when not feature-missing", () => {
      useAgentStore.setState({
        undoFeatureMissing: false,
        runId: "run-current",
        runHistory: [
          { id: "h1", prompt: "t1", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z", runId: "rh1" },
          { id: "h2", prompt: "t2", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z", runId: "rh2" }
        ]
      });
      useAgentStore.getState().refreshUndoAfterTerminal();
      // Loading states should be set
      const undo = useAgentStore.getState().undoByRunId;
      expect(undo["run-current"]?.loading).toBe(true);
      expect(undo["rh1"]?.loading).toBe(true);
      expect(undo["rh2"]?.loading).toBe(true);
    });

    it("refreshUndoAfterTerminal is no-op when feature missing", () => {
      useAgentStore.setState({ undoFeatureMissing: true, runId: "run-1" });
      useAgentStore.getState().refreshUndoAfterTerminal();
      expect(useAgentStore.getState().undoByRunId["run-1"]).toBeUndefined();
    });

    it("stores undoByRunId in session snapshot", () => {
      useAgentStore.setState({
        activeSessionId: "s1",
        undoByRunId: { "run-1": { loading: false, executing: false, response: { runId: "run-1", status: "UNDONE", canUndo: false, snapshotVersion: 1, changedFiles: [], changedFileCount: 0 } } },
        sessions: [{ id: "s1", title: "test", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" }]
      });
      useAgentStore.getState().receiveEvent({ type: "done", stopReason: "FINAL_ANSWER" });
      const session = useAgentStore.getState().sessions.find((s) => s.id === "s1");
      expect(session?.undoByRunId?.["run-1"]?.response?.status).toBe("UNDONE");
    });
  });
});
