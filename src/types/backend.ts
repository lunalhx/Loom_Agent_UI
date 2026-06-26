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
  | "edit_file"
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
  | "plan_updated"
  | "replan_started"
  | "checkpoint_saved"
  | "resume_started"
  | "sub_agent_started"
  | "sub_agent_completed"
  | "sub_agent_failed"
  | "sub_agent_summary"
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

export type AgentPlanItemStatus = "pending" | "in_progress" | "completed" | "blocked" | "skipped";

export type AgentPlanItemView = {
  id?: string;
  title: string;
  status: AgentPlanItemStatus;
  detail?: string;
};

export type AgentPlanView = {
  items: AgentPlanItemView[];
  title?: string;
  summary?: string;
  version?: number;
  updatedAt?: string;
};

export type AgentStreamEvent = {
  type: AgentEventType;
  /**
   * Backend TODO: return the 1-based agent loop iteration for every traceable
   * event. The UI falls back to `step` and local ordering until this is present.
   */
  iteration?: number;
  /**
   * Backend TODO: return a stable trace node type when `type` is too broad
   * (for example planner/model_call/tool_call/final_answer).
   */
  traceNodeType?: string;
  runId?: string;
  parentRunId?: string;
  requestId?: string;
  conversationId?: string;
  workspace?: string;
  elapsedMs?: number;
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
  subAgentId?: string;
  subAgentName?: string;
  subAgentRole?: string;
  subAgentStatus?: "started" | "completed" | "failed";
  subAgentSummary?: string;
  plan?: AgentPlanView;
  checkpointVersion?: number;
  /**
   * Backend TODO: include diff on approval_required and GET approval responses.
   * OLD_NEW uses oldText/newText; UNIFIED uses unifiedDiff.
   */
  diff?: DiffPayload;
};

export type AgentAskRequest = {
  question?: string;
  message?: string;
  conversationId?: string;
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
  /**
   * Backend TODO: include diff for write approvals when available.
   */
  diff?: DiffPayload;
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
