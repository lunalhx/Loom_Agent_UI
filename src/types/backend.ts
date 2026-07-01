export type ResponseCode = "0000" | "0001" | "0002" | "1001" | "1002" | "1003";

export type ApiResponse<T> = {
  code: string;
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
  | "delete_files"
  | "run_shell"
  | "git_op"
  | "activate_skill"
  | "create_skill"
  | "read_skill_resource"
  | "copy_skill_resource";

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
  | "skill_activated"
  | "thought"
  | "tool_call"
  | "approval_required"
  | "high_risk_approval_required"
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

export type InlineDiffPart = {
  type: "unchanged" | "removed" | "added";
  text: string;
};

export type StructuredDiffLine = {
  type: "context" | "removed" | "added" | "folded";
  oldLineNumber?: number;
  newLineNumber?: number;
  text?: string;
  pairId?: number;
  foldedCount?: number;
  inlineDiff?: InlineDiffPart[];
};

export type DiffHunk = {
  oldStart?: number;
  oldLines?: number;
  newStart?: number;
  newLines?: number;
  lines: StructuredDiffLine[];
};

export type DiffStats = {
  added: number;
  removed: number;
  modified?: number;
};

export type DiffPayload = {
  format: "OLD_NEW" | "UNIFIED";
  path: string;
  language?: string;
  oldText?: string;
  newText?: string;
  unifiedDiff?: string;
  hunks?: DiffHunk[];
  stats?: DiffStats;
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

export type DeletePreviewTarget = {
  path: string;
  kind: "FILE" | "DIRECTORY" | "SYMLINK";
};

export type DeleteApprovalPreview = {
  targetCount: number;
  fileCount: number;
  directoryCount: number;
  symlinkCount: number;
  totalBytes: number;
  targets: DeletePreviewTarget[];
  samplePaths: string[];
  truncated: boolean;
  riskFlags: string[];
  requiresSecondConfirmation: boolean;
};

export type AgentEventMetadata = {
  deletePreview?: DeleteApprovalPreview;
  kind?: string;
  skills?: SkillApprovalItem[];
  name?: string;
  source?: string;
  manifestSha256?: string;
  [key: string]: unknown;
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
  permissionLevel?: "READ_ONLY" | "WRITE_CONFIRM" | "HIGH_RISK_CONFIRM" | "HIGH_RISK_DENY";
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
  metadata?: AgentEventMetadata;
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
  skills?: string[];
  model?: "deepseek-v4-flash" | "deepseek-v4-pro";
};

export type AgentApprovalResponse = {
  approvalId: string;
  status: "PENDING";
  requestId: string;
  conversationId: string;
  workspace: string;
  tool: string;
  input: Record<string, unknown>;
  permissionLevel: "WRITE_CONFIRM" | "HIGH_RISK_CONFIRM";
  riskReason: string;
  operationPreview: string;
  expiresAt: string;
  /**
   * Backend TODO: include diff for write approvals when available.
  */
  diff?: DiffPayload;
  metadata?: AgentEventMetadata;
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

export type UndoStatus =
  | "OPEN"
  | "SUSPENDED"
  | "READY"
  | "NO_CHANGES"
  | "UNAVAILABLE"
  | "UNDOING"
  | "UNDONE"
  | "EXPIRED"
  | "FAILED";

export type UndoChangeType =
  | "ADDED"
  | "MODIFIED"
  | "DELETED"
  | "RENAMED"
  | "TYPE_CHANGED";

export type UndoChangedFile = {
  path: string;
  changeType: UndoChangeType;
  oldPath?: string;
};

export type AgentUndoResponse = {
  runId: string;
  status: UndoStatus;
  canUndo: boolean;
  snapshotVersion: number;
  changedFiles: UndoChangedFile[];
  changedFileCount: number;
  changedBytes?: number;
  restoredFiles?: string[];
  reasonCode?: string;
  reason?: string;
  expiresAt?: string;
};

export type AgentUndoRequest = {
  expectedSnapshotVersion: number;
};

// ---- Skill types ----

export type SkillSource = "user" | "project";

export type SkillTrustState = "trusted" | "approval_required";

export type SkillSummary = {
  name: string;
  description?: string;
  source: SkillSource;
  compatibility?: string;
  trustState: SkillTrustState;
  diagnostics?: string[];
};

export type SkillApprovalItem = {
  name: string;
  description: string;
  source: string;
  manifestSha256: string;
};

// ---- Conversation deletion types ----

export type ConversationDeletionStatus =
  | "REQUESTED"
  | "WAITING_FOR_RUNS"
  | "PURGING"
  | "COMPLETED"
  | "FAILED";

export type ConversationDeletionResponse = {
  conversationId: string;
  status: ConversationDeletionStatus;
  requestedAt: string;
  completedAt?: string;
  retryCount: number;
  lastError?: string;
};

// ---- Conversation list types ----

export type ConversationSummary = {
  conversationId: string;
  title: string;
  runCount: number;
  workspace: string;
};
