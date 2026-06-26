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
});
