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
      trace: [],
      approvals: {},
      recentFiles: [],
      answer: undefined,
      error: undefined,
      prompt: "mock task"
    });
  });

  it("derives steps, files, answer, and completion from a normal run", () => {
    for (const event of normalRun) {
      useAgentStore.getState().receiveEvent(event);
    }

    const state = useAgentStore.getState();
    expect(state.status).toBe("COMPLETED");
    expect(state.steps).toHaveLength(2);
    expect(state.plan[0].status).toBe("completed");
    expect(state.recentFiles).toContain("src/main.tsx");
    expect(state.answer).toContain("完成检查");
  });

  it("moves into WAITING_APPROVAL when approval is required", () => {
    for (const event of approvalRun) {
      useAgentStore.getState().receiveEvent(event);
    }

    const state = useAgentStore.getState();
    expect(state.status).toBe("WAITING_APPROVAL");
    expect(state.approvals["mock-approval-001"].status).toBe("pending");
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
});
