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
  | "run_started"
  | "node_start"
  | "plan_updated"
  | "replan_started"
  | "checkpoint_saved"
  | "resume_started"
  | "paused_for_approval"
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
  | "error"
  | "background_task_started"
  | "background_task_completed"
  | "background_task_failed"
  | "background_task_cancelled";

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
  /**
   * Path is informational and may be omitted by backends that ship a
   * `UNIFIED` diff (the file path is recoverable from the diff header).
   * The UI still prefers an explicit path when the OLD_NEW format is used.
   */
  path?: string;
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

export type BackgroundTaskStatus =
  | "STARTING"
  | "RUNNING"
  | "SUCCEEDED"
  | "FAILED"
  | "TIMED_OUT"
  | "CANCELLED"
  | "LOST";

export type BackgroundTask = {
  taskId: string;
  runId: string;
  command: string;
  cwd: string;
  status: BackgroundTaskStatus;
  exitCode?: number;
  errorCode?: string;
  errorMessage?: string;
  stdoutBytes: number;
  stderrBytes: number;
  launchMode: string;
  timeoutMs?: number;
  startedAt?: string;
  completedAt?: string;
};

export type BackgroundTaskDetail = BackgroundTask & {
  stdoutChunk?: string;
  stderrChunk?: string;
  stdoutOffset: number;
  stderrOffset: number;
  stdoutEof: boolean;
  stderrEof: boolean;
};

export type AgentUsageSummary = {
  runId?: string;
  traceId?: string;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  cacheHitTokens?: number;
  cacheMissTokens?: number;
  cacheHitRate?: number | null;
  status?: RunStatus;
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
  /**
   * Stable id for correlating a `tool_call` with its follow-up `observation`
   * and any approval/result events when multiple tool calls share a `step`.
   */
  toolCallId?: string;
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
  backgroundTask?: BackgroundTask;
  usage?: AgentUsageSummary | null;
  /**
   * When true on an `error` event, the backend believes the failure is
   * transient and the run can be resumed from its checkpoint.
   */
  recoverable?: boolean;
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
  status: "PENDING" | "DECIDED" | "RESUMED";
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
  /**
   * Optional machine-readable reason code from the backend for the current
   * approval pause. The UI uses it to label and filter the approval card.
   */
  reasonCode?: string;
  /**
   * Optional list of alternative actions the backend suggests for this
   * approval. The UI currently surfaces the simple approve/reject buttons and
   * may render these as advanced choices in a future iteration.
   */
  allowedAlternatives?: string[];
};

export type AgentApprovalDecisionRequest = {
  decision: "APPROVE" | "REJECT";
  reason?: string;
  /**
   * Optional machine-readable reason code. Forwarded to the backend when the
   * caller provides one; the existing approve/reject flow omits it.
   */
  reasonCode?: string;
  /**
   * Optional list of alternative actions to take alongside the decision.
   * Forwarded only when supplied.
   */
  allowedAlternatives?: string[];
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
  | "WAITING_USER_INPUT"
  | "RESUMING"
  | "COMPLETED"
  | "FAILED"
  | "ERROR"
  | "BUDGET_EXCEEDED"
  | "CANCELLED"
  | "CANCELLED_LOCAL"
  | "DISCONNECTED";

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

// ---- Run / runtime status types ----

/**
 * Backend runtime instance descriptor. The frontend keeps the `instanceId`
 * locally and re-queries this endpoint when the user reloads the page so it
 * can recalibrate sessions that were live on a previous instance.
 */
export type AgentRuntimeInfoResponse = {
  instanceId: string;
  startedAt: string;
  version?: string;
};

/**
 * Canonical run status returned by `GET /agent/code/runs/{runId}/status`.
 * The frontend calls this endpoint to reconcile the UI when a session is
 * switched, when the SSE disconnects unexpectedly, or when a previously
 * non-terminal session is observed after the backend restarted.
 */
export type AgentRunStatusResponse = {
  runId: string;
  status: RunStatus;
  conversationId?: string;
  requestId?: string;
  workspace?: string;
  checkpointVersion?: number;
  step?: number;
  stopReason?: StopReason;
  message?: string;
  updatedAt?: string;
  /**
   * When true, the run can be resumed from its current checkpoint via
   * `POST /agent/code/runs/{runId}/resume` (or the approval resume stream).
   */
  resumable?: boolean;
  /**
   * Best-effort token usage snapshot returned alongside the status. The UI
   * uses it to update the badge when a run is reconciled in the background.
   */
  usage?: AgentUsageSummary;
};

// ---- Trace / Replay types ----

/**
 * Backend trace summary. The current UI does not consume this endpoint, but
 * the type is declared so the runtime contract is fully covered and other
 * tools (CLI, replay viewer) can share it.
 */
export type AgentTrace = {
  runId: string;
  status: RunStatus;
  startedAt?: string;
  updatedAt?: string;
  events: AgentStreamEvent[];
  steps?: AgentRunStep[];
  usage?: AgentUsageSummary;
};

/**
 * A single agent loop iteration, surfaced by the trace endpoint.
 */
export type AgentRunStep = {
  step: number;
  iteration?: number;
  thought?: string;
  tool?: AgentTool;
  toolCallId?: string;
  input?: Record<string, unknown>;
  observation?: string;
  status?: "pending" | "running" | "completed" | "failed" | "blocked";
  startedAt?: string;
  completedAt?: string;
};

/**
 * Backend replay summary. The current UI does not consume this endpoint.
 */
export type AgentReplay = {
  runId: string;
  status: RunStatus;
  available: boolean;
  reason?: string;
  events?: AgentStreamEvent[];
};
