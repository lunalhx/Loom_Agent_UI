import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getAgentRuntime, getRunStatus, openApprovalDecisionStream, RunNotFoundError } from "./api";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("api run/runtime contract", () => {
  it("calls GET /agent/code/runtime and returns the runtime info", async () => {
    const response = {
      instanceId: "instance-1",
      startedAt: "2026-07-06T00:00:00.000Z",
      version: "1.0.0"
    };
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ code: "0000", info: "ok", data: response }), {
        headers: { "Content-Type": "application/json" }
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const runtime = await getAgentRuntime();

    expect(runtime).toEqual(response);
    expect(fetchMock).toHaveBeenCalledWith("/api/v1/agent/code/runtime");
  });

  it("getRunStatus returns the parsed status payload", async () => {
    const status = {
      runId: "run-1",
      status: "RUNNING" as const,
      checkpointVersion: 7,
      step: 3,
      updatedAt: "2026-07-06T00:00:01.000Z"
    };
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ code: "0000", data: status }))
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await getRunStatus("run-1");

    expect(result).toEqual(status);
    expect(fetchMock).toHaveBeenCalledWith("/api/v1/agent/code/runs/run-1/status");
  });

  it("getRunStatus throws RunNotFoundError when the backend reports run_not_found", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ code: "run_not_found", info: "run not found" }), {
        status: 404
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(getRunStatus("run-1")).rejects.toBeInstanceOf(RunNotFoundError);
  });

  it("getRunStatus treats a wrapped run_not_found in a 200 envelope as not found", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ code: "run_not_found", info: "expired", data: null }))
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(getRunStatus("run-1")).rejects.toBeInstanceOf(RunNotFoundError);
  });

  it("getRunStatus throws immediately for an empty run id", async () => {
    await expect(getRunStatus("")).rejects.toBeInstanceOf(RunNotFoundError);
  });

  it("openApprovalDecisionStream forwards optional new fields only when present", () => {
    let capturedBody: unknown;
    const fetchMock = vi.fn().mockImplementation((_url: string, init?: RequestInit) => {
      capturedBody = init?.body ? JSON.parse(String(init.body)) : null;
      return Promise.resolve(
        new Response("data: {}\n\n", {
          headers: { "Content-Type": "text/event-stream" }
        })
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const close = openApprovalDecisionStream("ap-1", { decision: "APPROVE" }, {
      onEvent: () => undefined
    });
    void Promise.resolve().then(() => close.close());

    expect(capturedBody).toEqual({ decision: "APPROVE" });

    const fetchMock2 = vi.fn().mockImplementation((_url: string, init?: RequestInit) => {
      capturedBody = init?.body ? JSON.parse(String(init.body)) : null;
      return Promise.resolve(
        new Response("data: {}\n\n", {
          headers: { "Content-Type": "text/event-stream" }
        })
      );
    });
    vi.stubGlobal("fetch", fetchMock2);
    const close2 = openApprovalDecisionStream(
      "ap-2",
      { decision: "REJECT", reason: "no", reasonCode: "policy_x", allowedAlternatives: ["abort"] },
      { onEvent: () => undefined }
    );
    void Promise.resolve().then(() => close2.close());

    expect(capturedBody).toEqual({
      decision: "REJECT",
      reason: "no",
      reasonCode: "policy_x",
      allowedAlternatives: ["abort"]
    });
  });
});
