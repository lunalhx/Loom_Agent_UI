import type {
  AgentApprovalDecisionRequest,
  AgentApprovalResponse,
  AgentAskRequest,
  AgentStreamEvent,
  AgentUndoRequest,
  AgentUndoResponse,
  AgentWorkspaceRequest,
  AgentWorkspaceResponse,
  AgentWorkspaceTreeRequest,
  AgentWorkspaceTreeResponse,
  ApiResponse,
  ModelConfigResponse
} from "@/types/backend";

export class FeatureMissingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FeatureMissingError";
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

async function parseApiResponse<T>(response: globalThis.Response): Promise<T> {
  if (response.status === 404 || response.status === 405) {
    throw new FeatureMissingError("后端接口不存在或方法不匹配");
  }

  const body = (await response.json()) as ApiResponse<T> | T;
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

export async function undoRun(runId: string, request: AgentUndoRequest): Promise<AgentUndoResponse> {
  const response = await fetch(`${API_BASE}/agent/code/runs/${runId}/undo`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request)
  });
  return parseApiResponse<AgentUndoResponse>(response);
}
