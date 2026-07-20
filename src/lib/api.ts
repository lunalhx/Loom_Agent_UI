import type {
  AgentApprovalDecisionRequest,
  AgentApprovalResponse,
  AgentAskRequest,
  AgentRunStatusResponse,
  AgentRuntimeInfoResponse,
  AgentStreamEvent,
  AgentUndoExecuteResponse,
  AgentUndoRequest,
  AgentUndoResponse,
  AgentUsageSummary,
  AgentWorkspaceRequest,
  AgentWorkspaceResponse,
  AgentWorkspaceTreeRequest,
  AgentWorkspaceTreeResponse,
  ApiResponse,
  BackgroundTask,
  BackgroundTaskDetail,
  ConversationDeletionResponse,
  ConversationSummary,
  ModelConfigResponse,
  SkillSummary
} from "@/types/backend";

export class FeatureMissingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FeatureMissingError";
  }
}

export class RunNotFoundError extends Error {
  code: string;
  runId: string;
  httpStatus: number;

  constructor(runId: string, code: string, info: string, httpStatus = 404) {
    super(info || code || `run ${runId} not found`);
    this.name = "RunNotFoundError";
    this.code = code;
    this.runId = runId;
    this.httpStatus = httpStatus;
  }
}

export class ApiRequestError extends Error {
  httpStatus: number;
  code: string;
  info: string;
  data?: unknown;

  constructor(httpStatus: number, code: string, info: string, data?: unknown) {
    super(info || code || `HTTP ${httpStatus}`);
    this.name = "ApiRequestError";
    this.httpStatus = httpStatus;
    this.code = code;
    this.info = info;
    this.data = data;
  }
}

const API_BASE = "/api/v1";

/**
 * Codes that indicate a missing/unimplemented endpoint rather than a generic
 * 404 from a path that happens to not exist. Keep this list tight so that
 * business-level 404s (e.g. run_not_found) are still surfaced as
 * `ApiRequestError`/`RunNotFoundError` and not swallowed as feature gaps.
 */
const FEATURE_MISSING_CODES = new Set<string>([
  "feature_missing",
  "endpoint_not_implemented"
]);

async function parseApiResponse<T>(response: globalThis.Response): Promise<T> {
  const raw = await response.text();
  if (response.status === 404 || response.status === 405) {
    let code: string | undefined;
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as Partial<ApiResponse<T>>;
        code = typeof parsed?.code === "string" ? parsed.code : undefined;
      } catch {
        // body is not JSON; treat as feature missing
      }
    }
    if (!code || FEATURE_MISSING_CODES.has(code)) {
      throw new FeatureMissingError("后端接口不存在或方法不匹配");
    }
  }

  if (!raw) {
    throw new ApiRequestError(response.status, "EMPTY_BODY", "后端响应为空");
  }
  const body = JSON.parse(raw) as ApiResponse<T> | T;
  if (typeof body === "object" && body && "code" in body) {
    const wrapped = body as ApiResponse<T>;
    if (wrapped.code !== "0000") {
      throw new ApiRequestError(response.status, wrapped.code, wrapped.info || "请求失败", wrapped.data);
    }
    return wrapped.data as T;
  }
  return body as T;
}

export async function getModelConfig() {
  const response = await fetch(`${API_BASE}/model/config`);
  return parseApiResponse<ModelConfigResponse>(response);
}

export async function getApproval(approvalId: string) {
  const response = await fetch(`${API_BASE}/agent/code/approvals/${approvalId}`);
  return parseApiResponse<AgentApprovalResponse>(response);
}

export async function resolveWorkspace(request: AgentWorkspaceRequest) {
  const response = await fetch(`${API_BASE}/agent/code/workspaces/resolve`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request)
  });
  return parseApiResponse<AgentWorkspaceResponse>(response);
}

export async function getWorkspaceTree(request: AgentWorkspaceTreeRequest) {
  const response = await fetch(`${API_BASE}/agent/code/workspaces/tree`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request)
  });
  return parseApiResponse<AgentWorkspaceTreeResponse>(response);
}

export type StreamHandlers = {
  onEvent: (event: AgentStreamEvent) => void;
  onOpen?: () => void;
  onDisconnect?: () => void;
  onError?: (error: Error) => void;
};

export type StreamHandle = {
  close: () => void;
};

export function openAgentAskStream(request: AgentAskRequest, handlers: StreamHandlers): StreamHandle {
  return openPostSseStream(`${API_BASE}/agent/code/ask/stream`, { includeTrace: true, ...request }, handlers);
}

export function openApprovalDecisionStream(
  approvalId: string,
  request: AgentApprovalDecisionRequest,
  handlers: StreamHandlers
): StreamHandle {
  return openPostSseStream(`${API_BASE}/agent/code/approvals/${approvalId}/decide/stream`, request, handlers);
}

function openPostSseStream(url: string, body: unknown, handlers: StreamHandlers): StreamHandle {
  const controller = new AbortController();

  void fetch(url, {
    method: "POST",
    headers: { Accept: "text/event-stream", "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: controller.signal
  })
    .then(async (response) => {
      if (!response.ok) {
        throw new Error(`SSE request failed: ${response.status}`);
      }
      if (!response.body) {
        throw new Error("SSE response body is empty");
      }
      handlers.onOpen?.();
      await readSse(response.body, handlers);
    })
    .catch((error) => {
      if (!controller.signal.aborted) {
        handlers.onError?.(error instanceof Error ? error : new Error(String(error)));
      }
    })
    .finally(() => {
      if (!controller.signal.aborted) {
        handlers.onDisconnect?.();
      }
    });

  return { close: () => controller.abort() };
}

async function readSse(body: ReadableStream<Uint8Array>, handlers: StreamHandlers) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, "\n");

    let separator = buffer.indexOf("\n\n");
    while (separator >= 0) {
      const rawEvent = buffer.slice(0, separator);
      buffer = buffer.slice(separator + 2);
      dispatchSseEvent(rawEvent, handlers);
      separator = buffer.indexOf("\n\n");
    }
  }

  if (buffer.trim()) {
    dispatchSseEvent(buffer, handlers);
  }
}

function dispatchSseEvent(rawEvent: string, handlers: StreamHandlers) {
  const data = rawEvent
    .split("\n")
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trimStart())
    .join("\n");

  if (!data) return;
  try {
    handlers.onEvent(JSON.parse(data) as AgentStreamEvent);
  } catch (error) {
    handlers.onError?.(error instanceof Error ? error : new Error(String(error)));
  }
}

export async function getRunUndo(runId: string): Promise<AgentUndoResponse> {
  const response = await fetch(`${API_BASE}/agent/code/runs/${runId}/undo`);
  return parseApiResponse<AgentUndoResponse>(response);
}

export async function getAgentRuntime(): Promise<AgentRuntimeInfoResponse> {
  const response = await fetch(`${API_BASE}/agent/code/runtime`);
  return parseApiResponse<AgentRuntimeInfoResponse>(response);
}

/**
 * Fetches the canonical status of a run. When the backend reports the run as
 * missing (e.g. after a restart lost the in-memory state) it throws
 * {@link RunNotFoundError} so the store can fall back to a local terminal
 * state instead of treating the lookup failure as a generic network error.
 */
export async function getRunStatus(runId: string): Promise<AgentRunStatusResponse> {
  if (!runId) {
    throw new RunNotFoundError(runId, "run_not_found", "run id is required", 404);
  }
  const response = await fetch(`${API_BASE}/agent/code/runs/${runId}/status`);
  if (response.status === 404) {
    const raw = await response.text().catch(() => "");
    let code: string | undefined;
    let info: string | undefined;
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as Partial<ApiResponse<unknown>>;
        code = typeof parsed?.code === "string" ? parsed.code : undefined;
        info = typeof parsed?.info === "string" ? parsed.info : undefined;
      } catch {
        // body is not JSON; keep code undefined so the generic 404 handler
        // does not misclassify this as a feature gap.
      }
    }
    throw new RunNotFoundError(runId, code || "run_not_found", info || `run ${runId} not found`, response.status);
  }
  const status = await parseApiResponse<AgentRunStatusResponse>(response).catch((error: unknown) => {
    if (error instanceof RunNotFoundError) {
      throw error;
    }
    if (error instanceof ApiRequestError && (error.code === "run_not_found" || error.httpStatus === 404)) {
      throw new RunNotFoundError(runId, error.code, error.info, error.httpStatus);
    }
    if (error instanceof FeatureMissingError) {
      throw new RunNotFoundError(runId, "run_not_found", `run ${runId} not found`, 404);
    }
    throw error;
  });
  if (!status || !status.runId) {
    throw new RunNotFoundError(runId, "run_not_found", `run ${runId} not found`, 404);
  }
  return status;
}

export async function querySkills(workspace?: string): Promise<SkillSummary[]> {
  const response = await fetch(`${API_BASE}/agent/code/skills/query`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ workspace })
  });
  return parseApiResponse<SkillSummary[]>(response);
}

export async function undoRun(runId: string, request: AgentUndoRequest): Promise<AgentUndoExecuteResponse> {
  const response = await fetch(`${API_BASE}/agent/code/runs/${runId}/undo`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request)
  });
  return parseApiResponse<AgentUndoExecuteResponse>(response);
}

export async function cancelAgentRun(runId: string): Promise<boolean> {
  const response = await fetch(`${API_BASE}/agent/code/runs/${runId}/cancel`, {
    method: "POST"
  });
  return parseApiResponse<boolean>(response);
}

export async function deleteConversation(conversationId: string): Promise<ConversationDeletionResponse> {
  const response = await fetch(`${API_BASE}/agent/code/conversations/${conversationId}`, {
    method: "DELETE"
  });
  if (response.status === 404) {
    throw new ApiRequestError(404, "NOT_FOUND", "会话不存在或已删除");
  }
  if (response.status === 400) {
    throw new ApiRequestError(400, "BAD_REQUEST", "参数非法");
  }
  return parseApiResponse<ConversationDeletionResponse>(response);
}

export async function getConversationDeletionStatus(conversationId: string): Promise<ConversationDeletionResponse> {
  const response = await fetch(`${API_BASE}/agent/code/conversations/${conversationId}/deletion`);
  return parseApiResponse<ConversationDeletionResponse>(response);
}

export async function listConversations(): Promise<ConversationSummary[]> {
  const response = await fetch(`${API_BASE}/agent/code/conversations`);
  return parseApiResponse<ConversationSummary[]>(response);
}

export async function fetchBackgroundTasks(runId: string): Promise<BackgroundTask[]> {
  const response = await fetch(`${API_BASE}/agent/code/runs/${runId}/background-tasks`);
  return parseApiResponse<BackgroundTask[]>(response);
}

export async function fetchBackgroundTaskDetail(
  runId: string,
  taskId: string,
  stdoutOffset?: number,
  stderrOffset?: number,
  limitBytes?: number
): Promise<BackgroundTaskDetail> {
  const params = new URLSearchParams();
  if (stdoutOffset !== undefined) params.set("stdoutOffset", String(stdoutOffset));
  if (stderrOffset !== undefined) params.set("stderrOffset", String(stderrOffset));
  if (limitBytes !== undefined) params.set("limitBytes", String(limitBytes));
  const qs = params.toString();
  const url = `${API_BASE}/agent/code/runs/${runId}/background-tasks/${taskId}${qs ? `?${qs}` : ""}`;
  const response = await fetch(url);
  return parseApiResponse<BackgroundTaskDetail>(response);
}

export async function getRunUsage(runId: string): Promise<AgentUsageSummary> {
  const response = await fetch(`${API_BASE}/agent/code/runs/${runId}/usage`);
  return parseApiResponse<AgentUsageSummary>(response);
}

export async function cancelBackgroundTask(runId: string, taskId: string): Promise<boolean> {
  const response = await fetch(`${API_BASE}/agent/code/runs/${runId}/background-tasks/${taskId}/cancel`, {
    method: "POST"
  });
  return parseApiResponse<boolean>(response);
}
