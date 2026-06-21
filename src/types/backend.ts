export type ResponseCode = "0000" | "0001" | "0002" | "1001" | "1002" | "1003";

export type ApiResponse<T> = {
  code: ResponseCode;
  info: string;
  data?: T;
};

export type ModelConfigResponse = {
  provider: "deepseek";
  baseUrl: string;
  model: string;
  temperature: number;
  maxTokens: number;
  apiKey: string;
  connectTimeoutMs: number;
  firstTokenTimeoutMs: number;
  streamTimeoutMs: number;
  retryMaxAttempts: number;
  allowedModels: string[];
};

export type ChatStreamRequest = {
  message: string;
  conversationId?: string;
  systemPrompt?: string;
  model?: "deepseek-v4-flash" | "deepseek-v4-pro";
  temperature?: number;
  maxTokens?: number;
  responseFormat?: "TEXT" | "JSON_OBJECT";
};

export type ChatStreamEvent = {
  type: "meta" | "token" | "done" | "error";
  requestId?: string;
  conversationId?: string;
  model?: string;
  token?: string;
  finishReason?: string;
  usage?: { promptTokens?: number; completionTokens?: number; totalTokens?: number };
  code?: string;
  message?: string;
};

export type AgentTool =
  | "list_dir"
  | "read_file"
  | "code_search"
  | "replace_in_file"
  | "write_file"
  | "run_shell"
  | "git_op";

export type AgentNode =
  | "start"
  | "render_prompt"
  | "model_call"
  | "decision"
  | "approval_gate"
  | "tool_dispatch"
  | "observation"
  | "final_answer"
  | "fail";

export type AgentEventType =
  | "meta"
  | "node_start"
  | "thought"
  | "tool_call"
  | "approval_required"
  | "policy_denied"
  | "observation"
  | "answer"
  | "done"
  | "error";

export type StopReason =
  | "FINAL_ANSWER"
  | "MAX_STEPS"
  | "PARSE_ERROR"
  | "TOOL_ERROR"
  | "TIMEOUT"
  | "MODEL_ERROR";

export type DiffPayload = {
  format: "OLD_NEW" | "UNIFIED";
  path: string;
  language?: string;
  oldText?: string;
  newText?: string;
  unifiedDiff?: string;
  editable: boolean;
};

export type AgentStreamEvent = {
  type: AgentEventType;
  requestId?: string;
  conversationId?: string;
  workspace?: string;
  step?: number;
  node?: AgentNode;
  nodeInputs?: string[];
  thought?: string;
  tool?: AgentTool;
  input?: Record<string, unknown>;
  approvalId?: string;
  permissionLevel?: "READ_ONLY" | "WRITE_CONFIRM" | "HIGH_RISK_DENY";
  riskReason?: string;
  operationPreview?: string;
  expiresAt?: string;
  observation?: string;
  truncated?: boolean;
  answer?: string;
  stopReason?: StopReason;
  stepCount?: number;
  code?: string;
  message?: string;
  diff?: DiffPayload;
};

export type AgentAskRequest = {
  question?: string;
  message?: string;
  workspace?: string;
  maxSteps?: number;
  includeTrace?: boolean;
};

export type AgentApprovalResponse = {
  approvalId: string;
  status: "PENDING";
  requestId: string;
  conversationId: string;
  workspace: string;
  tool: string;
  input: Record<string, unknown>;
  permissionLevel: "WRITE_CONFIRM";
  riskReason: string;
  operationPreview: string;
  expiresAt: string;
};

export type AgentApprovalDecisionRequest = {
  decision: "APPROVE" | "REJECT";
  reason?: string;
};

export type AgentWorkspaceRequest = {
  workspace?: string;
};

export type AgentWorkspaceResponse = {
  workspace: string;
  displayName: string;
  sandboxRoot: boolean;
  message?: string;
};

export type AgentWorkspaceTreeRequest = {
  workspace?: string;
  path?: string;
  limit?: number;
};

export type AgentWorkspaceTreeNode = {
  name: string;
  path: string;
  type: "directory" | "file";
  hasChildren: boolean;
  size?: number;
  lastModified?: number;
  children?: AgentWorkspaceTreeNode[];
};

export type AgentWorkspaceTreeResponse = {
  workspace: string;
  displayName: string;
  path: string;
  node: AgentWorkspaceTreeNode;
  truncated: boolean;
};

export type RunStatus =
  | "IDLE"
  | "CONNECTING"
  | "RUNNING"
  | "WAITING_APPROVAL"
  | "RESUMING"
  | "COMPLETED"
  | "ERROR"
  | "DISCONNECTED"
  | "CANCELLED_LOCAL";

export type CreateRunResponse = {
  runId: string;
  conversationId: string;
  streamUrl: string;
};

export type ApprovalDecisionResponse = {
  runId?: string;
  conversationId?: string;
  streamUrl: string;
};
