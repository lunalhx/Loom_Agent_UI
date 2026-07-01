import { create } from "zustand";
import {
  getWorkspaceTree,
  getModelConfig,
  openAgentAskStream,
  openApprovalDecisionStream,
  resolveWorkspace,
  getRunUndo,
  undoRun,
  querySkills,
  ApiRequestError,
  FeatureMissingError,
  type StreamHandle
} from "@/lib/api";
import { extractPaths, extractUnifiedDiff, formatTime, summarizeObservation, summarizeParams } from "@/lib/utils";
import type {
  AgentApprovalDecisionRequest,
  AgentAskRequest,
  AgentPlanItemStatus,
  AgentPlanView,
  AgentStreamEvent,
  AgentTool,
  AgentUndoResponse,
  AgentWorkspaceTreeNode,
  ModelConfigResponse,
  RunStatus,
  SkillSummary
} from "@/types/backend";

export type TimelineEntry = {
  id: string;
  event: AgentStreamEvent;
  receivedAt: string;
};

export type StepState = {
  step: number;
  thought?: string;
  tool?: AgentTool;
  input?: Record<string, unknown>;
  workspace?: string;
  observation?: string;
  truncated?: boolean;
  unifiedDiff?: string;
  status: "pending" | "running" | "completed" | "failed" | "blocked";
};

export type PlanItem = {
  id: string;
  title: string;
  status: "pending" | "doing" | "done" | "blocked" | "skipped";
  detail?: string;
};

export type TraceItem = {
  id: string;
  label: string;
  detail?: string;
  status?: string;
  time: string;
  type: string;
  iteration: number;
};

export type ApprovalState = {
  approvalId: string;
  status: "pending" | "approving" | "approved" | "executed" | "execution_failed" | "rejecting" | "rejected" | "expired";
  event: AgentStreamEvent;
};

export type RunHistoryItem = {
  id: string;
  prompt: string;
  createdAt: string;
  updatedAt: string;
  workspace?: string;
  status?: RunStatus;
  runId?: string;
  requestId?: string;
  conversationId?: string;
  events?: TimelineEntry[];
  steps?: StepState[];
  answer?: string;
  error?: string;
  skillNames?: string[];
};

export type Session = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  workspace?: string;
  prompt?: string;
  status?: RunStatus;
  runId?: string;
  requestId?: string;
  conversationId?: string;
  events?: TimelineEntry[];
  steps?: StepState[];
  plan?: PlanItem[];
  planTriggered?: boolean;
  trace?: TraceItem[];
  approvals?: Record<string, ApprovalState>;
  recentFiles?: string[];
  answer?: string;
  error?: string;
  runHistory?: RunHistoryItem[];
  undoByRunId?: Record<string, UndoViewState>;
};

export type LocalFileTarget = {
  name: string;
  size: number;
  type: string;
  lastModified: number;
  relativePath?: string;
  file?: File;
};

export type LocalFolderTarget = {
  name: string;
  fileCount: number;
  totalSize: number;
  paths: string[];
};

export type UndoViewState = {
  loading: boolean;
  executing: boolean;
  response?: AgentUndoResponse;
  errorCode?: string;
  error?: string;
};

const defaultModels = ["deepseek-v4-flash", "deepseek-v4-pro"];

type WorkspaceSkillPreference = {
  selectedNames: string[];
  knownNames: string[];
};

const skillPreferenceStorageKey = "loom-agent:skill-selections:v1";

function readSkillPreferences(): Record<string, WorkspaceSkillPreference> {
  try {
    const raw = localStorage.getItem(skillPreferenceStorageKey);
    return raw ? (JSON.parse(raw) as Record<string, WorkspaceSkillPreference>) : {};
  } catch {
    return {};
  }
}

function writeSkillPreferences(prefs: Record<string, WorkspaceSkillPreference>): void {
  try {
    localStorage.setItem(skillPreferenceStorageKey, JSON.stringify(prefs));
  } catch { /* ignore quota */ }
}

type AgentState = {
  modelConfig?: ModelConfigResponse;
  allowedModels: string[];
  selectedModel: string;
  status: RunStatus;
  statusMessage?: string;
  activeSessionId?: string;
  runId?: string;
  requestId?: string;
  conversationId?: string;
  workspace: string;
  workspaceDisplayName?: string;
  workspaceMessage?: string;
  workspaceTree?: AgentWorkspaceTreeNode;
  workspaceTreeLoading: boolean;
  workspaceTreeError?: string;
  prompt: string;
  submittedPrompt?: string;
  events: TimelineEntry[];
  steps: StepState[];
  plan: PlanItem[];
  planTriggered: boolean;
  trace: TraceItem[];
  approvals: Record<string, ApprovalState>;
  recentFiles: string[];
  runHistory: RunHistoryItem[];
  selectedLocalFile?: LocalFileTarget;
  selectedLocalFolder?: LocalFolderTarget;
  answer?: string;
  error?: string;
  usage?: { promptTokens?: number; completionTokens?: number; totalTokens?: number; costUsd?: number };
  sessions: Session[];
  stream?: StreamHandle;
  undoByRunId: Record<string, UndoViewState>;
  undoDialogRunId?: string;
  undoFeatureMissing: boolean;
  availableSkills: SkillSummary[];
  selectedSkillNames: string[];
  skillsLoading: boolean;
  skillsError?: string;
  skillsWorkspace?: string;
  loadModelConfig: () => Promise<void>;
  setSelectedModel: (model: string) => void;
  setPrompt: (prompt: string) => void;
  setWorkspace: (workspace: string) => void;
  newSession: () => void;
  selectSession: (sessionId: string) => void;
  setSelectedLocalFile: (file?: File) => void;
  setSelectedLocalFolder: (files?: FileList | File[]) => void;
  resolveCurrentWorkspace: () => Promise<void>;
  loadWorkspaceTree: (path?: string) => Promise<void>;
  loadSkills: (workspace?: string) => Promise<void>;
  toggleSkill: (name: string) => void;
  selectAllUserSkills: () => void;
  clearSelectedSkills: () => void;
  startRun: () => Promise<void>;
  replayMock: (sequence: AgentStreamEvent[]) => void;
  receiveEvent: (event: AgentStreamEvent) => void;
  stopRun: () => void;
  decide: (approvalId: string, decision: AgentApprovalDecisionRequest["decision"], reason?: string) => Promise<void>;
  loadUndo: (runId: string) => Promise<void>;
  loadUndoStack: (runIds: string[]) => Promise<void>;
  openUndoDialog: (runId: string) => void;
  closeUndoDialog: () => void;
  confirmUndo: (runId: string) => Promise<void>;
  refreshUndoAfterTerminal: () => void;
};

const sessionStorageKey = "loom-agent:sessions";

function readSessions(): Session[] {
  try {
    const raw = localStorage.getItem(sessionStorageKey);
    return raw ? (JSON.parse(raw) as Session[]) : [];
  } catch {
    return [];
  }
}

function writeSessions(sessions: Session[]) {
  localStorage.setItem(sessionStorageKey, JSON.stringify(sessions.slice(0, 20)));
}

function snapshotSession(state: AgentState, patch: Partial<AgentState> = {}): Session | undefined {
  const activeSessionId = patch.activeSessionId ?? state.activeSessionId;
  if (!activeSessionId) return undefined;
  const session = state.sessions.find((item) => item.id === activeSessionId);
  if (!session) return undefined;

  const submittedPrompt = patch.submittedPrompt ?? state.submittedPrompt;
  const workspace = patch.workspace ?? state.workspace;
  const answer = patch.answer ?? state.answer;
  const error = patch.error ?? state.error;

  return {
    ...session,
    title: titleFromPrompt(submittedPrompt || session.prompt || session.title),
    updatedAt: new Date().toISOString(),
    workspace: workspace || session.workspace,
    prompt: submittedPrompt || session.prompt,
    status: patch.status ?? state.status,
    runId: patch.runId ?? state.runId,
    requestId: patch.requestId ?? state.requestId,
    conversationId: patch.conversationId ?? state.conversationId,
    events: patch.events ?? state.events,
    steps: patch.steps ?? state.steps,
    plan: patch.plan ?? state.plan,
    planTriggered: patch.planTriggered ?? state.planTriggered,
    trace: patch.trace ?? state.trace,
    approvals: patch.approvals ?? state.approvals,
    recentFiles: patch.recentFiles ?? state.recentFiles,
    answer,
    error,
    runHistory: patch.runHistory ?? state.runHistory,
    undoByRunId: patch.undoByRunId ?? state.undoByRunId
  };
}

function upsertSessionSnapshot(sessions: Session[], snapshot?: Session) {
  if (!snapshot) return sessions;
  const next = sessions.map((session) => (session.id === snapshot.id ? snapshot : session));
  writeSessions(next);
  return next;
}

function titleFromPrompt(prompt: string) {
  const normalized = prompt.trim().replace(/\s+/g, " ");
  return normalized ? normalized.slice(0, 42) : "Untitled run";
}

function snapshotCurrentRun(state: AgentState): RunHistoryItem | undefined {
  const prompt = state.submittedPrompt?.trim();
  if (!prompt) return undefined;
  const hasRunContent =
    state.events.length > 0 ||
    state.steps.length > 0 ||
    Boolean(state.answer) ||
    Boolean(state.error) ||
    !["IDLE", "CONNECTING"].includes(state.status);
  if (!hasRunContent) return undefined;

  return {
    id: state.runId || state.requestId || crypto.randomUUID(),
    prompt,
    createdAt: state.events[0]?.receivedAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    workspace: state.workspace || undefined,
    status: state.status,
    runId: state.runId,
    requestId: state.requestId,
    conversationId: state.conversationId,
    events: state.events,
    steps: state.steps,
    answer: state.answer,
    error: state.error,
    skillNames: [...state.selectedSkillNames]
  };
}

function upsertStep(steps: StepState[], stepNumber: number, patch: Partial<StepState>): StepState[] {
  const existing = steps.find((step) => step.step === stepNumber);
  if (existing) {
    return steps.map((step) => (step.step === stepNumber ? { ...step, ...patch } : step));
  }
  const next: StepState = { step: stepNumber, status: "running", ...patch };
  return [...steps, next].sort((a, b) => a.step - b.step);
}

function mapPlanStatus(status: AgentPlanItemStatus): PlanItem["status"] {
  if (status === "completed") return "done";
  if (status === "in_progress") return "doing";
  return status;
}

function planFromEvent(plan?: AgentPlanView): PlanItem[] | undefined {
  if (!plan?.items) return undefined;
  return plan.items.map((item, index) => ({
    id: item.id || `plan-${index}`,
    title: item.title,
    status: mapPlanStatus(item.status),
    detail: item.detail
  }));
}

function isApprovalRequired(event: AgentStreamEvent) {
  return event.type === "approval_required" || event.type === "high_risk_approval_required";
}

function traceDetail(event: AgentStreamEvent) {
  if (event.type === "node_start") return event.nodeInputs?.join(", ");
  if (event.type === "checkpoint_saved") return event.checkpointVersion ? `checkpoint v${event.checkpointVersion}` : "checkpoint saved";
  if (event.type === "resume_started") return event.approvalId ? `approval ${event.approvalId}` : "resume started";
  if (event.type.startsWith("sub_agent")) return event.subAgentSummary || event.subAgentRole || event.subAgentId;
  if (event.type === "plan_updated") return event.plan?.summary || `${event.plan?.items.length ?? 0} items`;
  if (event.type === "replan_started") return event.plan?.summary || "replanning";
  if (event.type === "done") return event.stopReason;
  if (event.type === "error") return event.message || event.code;
  if (isApprovalRequired(event)) return event.operationPreview || event.riskReason;
  return undefined;
}

function traceStatus(event: AgentStreamEvent) {
  if (event.type === "error" || event.type === "sub_agent_failed") return "error";
  if (event.type === "done" || event.type === "sub_agent_completed" || event.type === "checkpoint_saved") return "done";
  if (isApprovalRequired(event)) return "blocked";
  if (event.type === "replan_started" || event.type === "resume_started" || event.type === "sub_agent_started") return "running";
  return undefined;
}

function traceType(event: AgentStreamEvent, fallback?: string) {
  if (event.traceNodeType) return event.traceNodeType;
  if (event.type === "node_start") return event.node || fallback || "meta";
  if (event.type === "tool_call" || event.type === "policy_denied" || isApprovalRequired(event)) return "tool_call";
  if (event.type === "plan_updated" || event.type === "replan_started") return "plan_updated";
  if (event.type === "answer" || event.type === "done") return "final_answer";
  if (event.type === "thought") return "planner";
  if (event.type === "meta") return "meta";
  if (event.type === "skill_activated") return "skill";
  if (event.type === "observation" || event.type === "checkpoint_saved") return "meta";
  return fallback || event.type;
}

function eventIteration(event: AgentStreamEvent, trace: TraceItem[]) {
  if (event.iteration && event.iteration > 0) return event.iteration;
  if (event.step && event.step > 0) return event.step;
  return Math.max(1, trace.at(-1)?.iteration || 1);
}

function normalizeTrace(trace: TraceItem[] | undefined): TraceItem[] {
  return (trace || []).map((item, index) => ({
    ...item,
    type: item.type || (item.status === "done" ? "final_answer" : "meta"),
    iteration: item.iteration || Math.max(1, index + 1)
  }));
}

async function promptWithAttachment(prompt: string, selectedLocalFile?: LocalFileTarget) {
  const file = selectedLocalFile?.file;
  if (!file) return prompt;
  const displayPath = selectedLocalFile.relativePath || selectedLocalFile.name;
  const prefix = `\n\n[Attached file: ${displayPath}]\n\`\`\`\n`;
  const suffix = "\n```";
  const maxContentLength = Math.max(0, 3900 - prompt.length - prefix.length - suffix.length);
  if (maxContentLength === 0) {
    return prompt;
  }
  try {
    const content = await file.text();
    const clipped = content.length > maxContentLength ? `${content.slice(0, Math.max(0, maxContentLength - 24))}\n[truncated]` : content;
    return `${prompt}${prefix}${clipped}${suffix}`;
  } catch {
    return `${prompt}\n\n[Attached file skipped: ${displayPath} could not be read as text.]`;
  }
}

function mergeTreeNode(
  current: AgentWorkspaceTreeNode | undefined,
  targetPath: string,
  nextNode: AgentWorkspaceTreeNode
): AgentWorkspaceTreeNode {
  if (!current || targetPath === "" || current.path === targetPath) {
    return nextNode;
  }
  return {
    ...current,
    children: current.children?.map((child) => (child.path === targetPath ? nextNode : mergeTreeNode(child, targetPath, nextNode)))
  };
}

const undoErrorLabels: Record<string, string> = {
  workspace_changed_after_run: "文件在任务结束后又被修改，未执行撤销",
  workspace_changed_while_suspended: "暂停期间工作区被修改，撤销不可用",
  workspace_undo_busy: "另一个 run 正占用工作区，请稍后重试",
  undo_not_latest: "必须先处理更新的一轮修改",
  git_head_changed: "当前分支或 HEAD 已变化，不能安全撤销",
  undo_already_applied: "本轮修改已经撤销",
  undo_snapshot_expired: "撤销点已过期",
  undo_not_available: "本轮包含不可逆 Git 操作",
  undo_failed_rolled_back: "撤销失败，工作区已恢复到执行前状态",
  undo_recovery_required: "自动恢复失败，需要人工检查 Git 状态"
};

function pollUndoUntilReady(runId: string) {
  const delays = [250, 500, 1000];
  let attempts = 0;

  const tryPoll = () => {
    const current = useAgentStore.getState().undoByRunId[runId];
    if (current?.response?.status !== "OPEN" && current?.response?.status !== "SUSPENDED" && current?.response?.status !== undefined) return;
    if (attempts >= delays.length) return;

    setTimeout(() => {
      const latest = useAgentStore.getState().undoByRunId[runId];
      if (latest?.response?.status !== "OPEN" && latest?.response?.status !== "SUSPENDED") return;
      attempts++;
      void useAgentStore.getState().loadUndo(runId).then(() => {
        const after = useAgentStore.getState().undoByRunId[runId];
        if ((after?.response?.status === "OPEN" || after?.response?.status === "SUSPENDED") && attempts < delays.length) {
          tryPoll();
        }
      });
    }, delays[attempts]);
  };

  tryPoll();
}

export const useAgentStore = create<AgentState>((set, get) => ({
  allowedModels: defaultModels,
  selectedModel: defaultModels[0],
  status: "IDLE",
  workspace: "",
  workspaceTreeLoading: false,
  prompt: "",
  submittedPrompt: undefined,
  events: [],
  steps: [],
  plan: [],
  planTriggered: false,
  trace: [],
  approvals: {},
  recentFiles: [],
  runHistory: [],
  sessions: typeof localStorage === "undefined" ? [] : readSessions(),
  undoByRunId: {},
  undoFeatureMissing: false,
  availableSkills: [],
  selectedSkillNames: [],
  skillsLoading: false,
  skillsError: undefined,
  skillsWorkspace: undefined,

  loadModelConfig: async () => {
    try {
      const modelConfig = await getModelConfig();
      set({
        modelConfig,
        allowedModels: modelConfig.allowedModels?.length ? modelConfig.allowedModels : defaultModels,
        selectedModel: modelConfig.model || get().selectedModel
      });
    } catch (error) {
      set({
        statusMessage: error instanceof Error ? error.message : "模型配置读取失败"
      });
    }
  },

  setSelectedModel: (selectedModel) => set({ selectedModel }),
  setPrompt: (prompt) => set({ prompt }),
  newSession: () =>
    set((state) => {
      state.stream?.close();
      return {
        activeSessionId: undefined,
        runId: undefined,
        requestId: undefined,
        conversationId: undefined,
        status: "IDLE",
        statusMessage: "new session",
        prompt: "",
        submittedPrompt: undefined,
        error: undefined,
        answer: undefined,
        events: [],
        steps: [],
        plan: [],
        planTriggered: false,
        trace: [],
        approvals: {},
        recentFiles: [],
        runHistory: [],
        selectedLocalFile: undefined,
        selectedLocalFolder: undefined,
        undoByRunId: {},
        undoDialogRunId: undefined,
        undoFeatureMissing: false,
        stream: undefined
      };
    }),
  selectSession: (sessionId) =>
    set((state) => {
      const session = state.sessions.find((item) => item.id === sessionId);
      if (!session) return {};
      state.stream?.close();
      const restoredUndo = session.undoByRunId || {};
      // Reset stale executing/loading states
      const sanitizedUndo: Record<string, UndoViewState> = {};
      for (const [key, value] of Object.entries(restoredUndo)) {
        sanitizedUndo[key] = {
          ...value,
          loading: false,
          executing: false
        };
      }
      // Query undo for current run + last 10 history runs
      const currentRunId = session.runId;
      const historyRunIds = (session.runHistory || []).map((r) => r.runId).filter(Boolean).slice(0, 10) as string[];
      const idsToQuery = currentRunId ? [currentRunId, ...historyRunIds] : historyRunIds;
      setTimeout(() => {
        void useAgentStore.getState().loadUndoStack(idsToQuery);
      }, 0);
      return {
        activeSessionId: session.id,
        runId: session.runId,
        requestId: session.requestId,
        conversationId: session.conversationId,
        status: session.status || "IDLE",
        statusMessage: "session selected",
        prompt: session.prompt || session.title,
        submittedPrompt: session.prompt || session.title,
        workspace: session.workspace || state.workspace,
        error: session.error,
        answer: session.answer,
        events: session.events || [],
        steps: session.steps || [],
        plan: session.plan || [],
        planTriggered:
          session.planTriggered ??
          Boolean(
            session.events?.some(
              ({ event }) =>
                event.type === "plan_updated" ||
                event.type === "replan_started" ||
                (event.type === "resume_started" && Boolean(event.plan))
            )
          ),
        trace: normalizeTrace(session.trace),
        approvals: session.approvals || {},
        recentFiles: session.recentFiles || [],
        runHistory: session.runHistory || [],
        undoByRunId: sanitizedUndo,
        undoFeatureMissing: false,
        stream: undefined
      };
    }),
  setWorkspace: (workspace) =>
    set({
      workspace,
      workspaceDisplayName: undefined,
      workspaceMessage: undefined,
      workspaceTree: undefined,
      workspaceTreeError: undefined
    }),
  setSelectedLocalFile: (file) =>
    set((state) => {
      if (!file) return { selectedLocalFile: undefined };
      const relativePath = "webkitRelativePath" in file ? String(file.webkitRelativePath || "") : "";
      const displayPath = relativePath || file.name;
      return {
        selectedLocalFile: {
          name: file.name,
          size: file.size,
          type: file.type,
          lastModified: file.lastModified,
          relativePath: relativePath || undefined,
          file
        },
        recentFiles: Array.from(new Set([displayPath, ...state.recentFiles])).slice(0, 24)
      };
    }),
  setSelectedLocalFolder: (files) =>
    set((state) => {
      const fileArray = files ? Array.from(files) : [];
      if (fileArray.length === 0) return { selectedLocalFolder: undefined };

      const paths = fileArray
        .map((file) => {
          const directoryFile = file as File & { webkitRelativePath?: string };
          return directoryFile.webkitRelativePath || file.name;
        })
        .filter(Boolean);
      const firstPath = paths[0] || "selected-folder";
      const rootName = firstPath.includes("/") ? firstPath.split("/")[0] : firstPath;
      const previewPaths = paths.slice(0, 80);
      const totalSize = fileArray.reduce((sum, file) => sum + file.size, 0);

      return {
        selectedLocalFolder: {
          name: rootName,
          fileCount: fileArray.length,
          totalSize,
          paths: previewPaths
        },
        recentFiles: Array.from(new Set([...previewPaths, ...state.recentFiles])).slice(0, 80)
      };
    }),

  resolveCurrentWorkspace: async () => {
    const workspace = get().workspace.trim();
    set({ workspaceTreeLoading: true, workspaceTreeError: undefined, workspaceMessage: undefined });
    try {
      const resolved = await resolveWorkspace({ workspace: workspace || undefined });
      set({
        workspace: resolved.workspace,
        workspaceDisplayName: resolved.displayName,
        workspaceMessage: resolved.message,
        workspaceTree: undefined
      });
      await get().loadWorkspaceTree("");
      // Load skills in parallel after workspace is resolved
      get().loadSkills(resolved.workspace);
    } catch (error) {
      set({
        workspaceTreeLoading: false,
        workspaceTreeError: error instanceof Error ? error.message : "工作目录校验失败"
      });
    }
  },

  loadWorkspaceTree: async (path = "") => {
    const workspace = get().workspace.trim();
    if (!workspace) {
      set({ workspaceTreeError: "请先填写 workspace path" });
      return;
    }
    set({ workspaceTreeLoading: true, workspaceTreeError: undefined });
    try {
      const response = await getWorkspaceTree({ workspace, path, limit: 200 });
      set((state) => ({
        workspace: response.workspace,
        workspaceDisplayName: response.displayName,
        workspaceTree: mergeTreeNode(state.workspaceTree, response.path, response.node),
        workspaceTreeLoading: false,
        workspaceTreeError: response.truncated ? "目录较大，当前只显示前 200 项" : undefined
      }));
    } catch (error) {
      set({
        workspaceTreeLoading: false,
        workspaceTreeError: error instanceof Error ? error.message : "目录树读取失败"
      });
    }
  },

  loadSkills: async (workspace) => {
    const w = workspace ?? get().workspace.trim();
    if (!w) {
      set({ availableSkills: [], selectedSkillNames: [], skillsLoading: false });
      return;
    }
    set({ skillsLoading: true, skillsError: undefined, skillsWorkspace: w });
    try {
      const skills = await querySkills(w);
      const prefs = readSkillPreferences();
      const entry = prefs[w];
      const knownNames = entry?.knownNames ?? [];
      const knownSet = new Set(knownNames);
      const prevSelected = new Set(entry?.selectedNames ?? []);

      // Merge: known skills keep prior selection, new user skills default selected, new project default not
      const selectedNames: string[] = [];
      for (const s of skills) {
        if (knownSet.has(s.name)) {
          if (prevSelected.has(s.name)) {
            selectedNames.push(s.name);
          }
        } else if (s.source === "user") {
          selectedNames.push(s.name);
        }
      }

      const newKnown = skills.map((s) => s.name);
      set({
        availableSkills: skills,
        selectedSkillNames: selectedNames,
        skillsLoading: false,
        skillsError: undefined,
        skillsWorkspace: w
      });
      // Persist
      const nextPrefs = readSkillPreferences();
      nextPrefs[w] = { selectedNames, knownNames: newKnown };
      writeSkillPreferences(nextPrefs);
    } catch (error) {
      set({
        skillsLoading: false,
        skillsError: error instanceof Error ? error.message : "技能查询失败"
      });
    }
  },

  toggleSkill: (name) => {
    set((state) => {
      const selected = state.selectedSkillNames.includes(name)
        ? state.selectedSkillNames.filter((n) => n !== name)
        : [...state.selectedSkillNames, name];
      const w = state.skillsWorkspace || state.workspace.trim();
      if (w) {
        const nextPrefs = readSkillPreferences();
        const entry = nextPrefs[w] ?? { selectedNames: [], knownNames: state.availableSkills.map((s) => s.name) };
        nextPrefs[w] = { ...entry, selectedNames: selected };
        writeSkillPreferences(nextPrefs);
      }
      return { selectedSkillNames: selected };
    });
  },

  selectAllUserSkills: () => {
    set((state) => {
      const userNames = state.availableSkills
        .filter((s) => s.source === "user")
        .map((s) => s.name);
      const selected = [...new Set([...state.selectedSkillNames, ...userNames])];
      const w = state.skillsWorkspace || state.workspace.trim();
      if (w) {
        const nextPrefs = readSkillPreferences();
        const entry = nextPrefs[w] ?? { selectedNames: [], knownNames: state.availableSkills.map((s) => s.name) };
        nextPrefs[w] = { ...entry, selectedNames: selected };
        writeSkillPreferences(nextPrefs);
      }
      return { selectedSkillNames: selected };
    });
  },

  clearSelectedSkills: () => {
    set((state) => {
      const w = state.skillsWorkspace || state.workspace.trim();
      if (w) {
        const nextPrefs = readSkillPreferences();
        const entry = nextPrefs[w] ?? { selectedNames: [], knownNames: state.availableSkills.map((s) => s.name) };
        nextPrefs[w] = { ...entry, selectedNames: [] };
        writeSkillPreferences(nextPrefs);
      }
      return { selectedSkillNames: [] };
    });
  },

  startRun: async () => {
    const state = get();
    const prompt = state.prompt.trim();
    if (!prompt) {
      set({ status: "ERROR", error: "question 不能为空" });
      return;
    }

    state.stream?.close();
    const createdAt = new Date().toISOString();
    const activeSession = state.activeSessionId ? state.sessions.find((item) => item.id === state.activeSessionId) : undefined;
    const previousRun = snapshotCurrentRun(state);
    const runHistory = previousRun ? [...state.runHistory, previousRun] : state.runHistory;
    const session: Session = {
      ...(activeSession || {
        id: crypto.randomUUID(),
        createdAt
      }),
      title: titleFromPrompt(prompt),
      updatedAt: createdAt,
      workspace: state.workspace || undefined,
      prompt,
      status: "CONNECTING",
      runId: undefined,
      requestId: undefined,
      conversationId: state.conversationId,
      events: [],
      steps: [],
      plan: [],
      planTriggered: false,
      trace: [],
      approvals: {},
      recentFiles: [],
      answer: undefined,
      error: undefined,
      runHistory
    };
    const sessions = [session, ...state.sessions.filter((item) => item.id !== session.id)].slice(0, 20);
    writeSessions(sessions);

    set({
      activeSessionId: session.id,
      sessions,
      status: "CONNECTING",
      statusMessage: "connecting",
      prompt: "",
      submittedPrompt: prompt,
      error: undefined,
      answer: undefined,
      events: [],
      steps: [],
      plan: [],
      planTriggered: false,
      trace: [],
      approvals: {},
      recentFiles: [],
      runHistory,
      undoDialogRunId: undefined
    });

    try {
      const message = await promptWithAttachment(prompt, state.selectedLocalFile);
      const request: AgentAskRequest = {
        question: message,
        message,
        conversationId: state.conversationId || undefined,
        workspace: state.workspace || undefined,
        includeTrace: true,
        skills: [...state.selectedSkillNames]
      };
      const stream = openAgentAskStream(request, {
        onOpen: () => set({ status: "RUNNING", statusMessage: "connected" }),
        onEvent: get().receiveEvent,
        onDisconnect: () => {
          const status = get().status;
          if (!["COMPLETED", "ERROR", "WAITING_APPROVAL", "CANCELLED_LOCAL"].includes(status)) {
            set({ status: "DISCONNECTED", statusMessage: "disconnected" });
          }
          if (["COMPLETED", "ERROR"].includes(status)) {
            setTimeout(() => get().refreshUndoAfterTerminal(), 100);
          }
        },
        onError: (error) => set({ status: "ERROR", error: error.message })
      });
      set({ stream });
    } catch (error) {
      const message = error instanceof Error ? error.message : "运行创建失败";
      set({ status: "ERROR", error: message, statusMessage: "error" });
    }
  },

  replayMock: (sequence) => {
    get().stream?.close();
    set({
      status: "RUNNING",
      error: undefined,
      answer: undefined,
      events: [],
      steps: [],
      plan: [],
      planTriggered: false,
      trace: [],
      approvals: {},
      recentFiles: [],
      statusMessage: "mock replay"
    });
    for (const event of sequence) {
      get().receiveEvent(event);
    }
  },

  receiveEvent: (event) => {
    set((state) => {
      const time = formatTime();
      const events = [...state.events, { id: crypto.randomUUID(), event, receivedAt: time }];
      let steps = state.steps;
      let plan = state.plan;
      let planTriggered = state.planTriggered;
      let trace = state.trace;
      let approvals = state.approvals;
      let recentFiles = state.recentFiles;
      let nextStatus = state.status;
      let answer = state.answer;
      let error = state.error;
      let requestId = state.requestId;
      let conversationId = state.conversationId;
      let workspace = state.workspace;
      let runId = state.runId;

      runId = event.runId || runId;
      requestId = event.requestId || requestId;
      conversationId = event.conversationId || conversationId;
      workspace = event.workspace || workspace;

      if (event.type === "meta") {
        nextStatus = "RUNNING";
        trace = [
          ...trace,
          {
            id: crypto.randomUUID(),
            label: "meta",
            detail: event.runId || event.requestId,
            time,
            type: traceType(event),
            iteration: eventIteration(event, trace)
          }
        ];
      }

      if (
        event.type === "node_start" ||
        event.type === "checkpoint_saved" ||
        event.type === "resume_started" ||
        event.type === "sub_agent_started" ||
        event.type === "sub_agent_completed" ||
        event.type === "sub_agent_failed" ||
        event.type === "sub_agent_summary" ||
        event.type === "skill_activated"
      ) {
        trace = [
          ...trace,
          {
            id: crypto.randomUUID(),
            label: event.type === "skill_activated"
              ? `skill · ${event.metadata?.name || "unknown"}`
              : (event.node || event.subAgentName || event.type),
            detail: event.type === "skill_activated"
              ? `来源: ${event.metadata?.source || "unknown"}`
              : traceDetail(event),
            status: "done",
            time,
            type: event.type === "skill_activated" ? "skill" : traceType(event),
            iteration: eventIteration(event, trace)
          }
        ];
      }

      if (event.type === "plan_updated" || event.type === "replan_started") {
        planTriggered = true;
        const nextPlan = planFromEvent(event.plan);
        if (nextPlan) {
          plan = nextPlan;
        }
        trace = [
          ...trace,
          {
            id: crypto.randomUUID(),
            label: event.type === "plan_updated" ? "plan updated" : "replan started",
            detail: traceDetail(event),
            status: event.type === "replan_started" ? "running" : "done",
            time,
            type: traceType(event),
            iteration: eventIteration(event, trace)
          }
        ];
      }

      if (event.type === "resume_started") {
        const nextPlan = planFromEvent(event.plan);
        if (nextPlan) {
          plan = nextPlan;
          planTriggered = true;
        }
      }

      if (event.type === "thought" && event.step) {
        steps = upsertStep(steps, event.step, {
          thought: event.thought,
          status: "running"
        });
        trace = [
          ...trace,
          {
            id: crypto.randomUUID(),
            label: `step ${event.step} · thinking`,
            detail: event.thought,
            status: "running",
            time,
            type: traceType(event),
            iteration: eventIteration(event, trace)
          }
        ];
      }

      if ((event.type === "tool_call" || event.type === "policy_denied") && event.step) {
        steps = upsertStep(steps, event.step, {
          tool: event.tool,
          input: event.input,
          workspace: event.workspace,
          status: event.type === "policy_denied" ? "failed" : "running"
        });
        trace = [
          ...trace,
          {
            id: crypto.randomUUID(),
            label: `tool · ${event.tool || "unknown"}`,
            detail: summarizeParams(event.input),
            status: event.type === "policy_denied" ? "error" : "running",
            time,
            type: traceType(event),
            iteration: eventIteration(event, trace)
          }
        ];
      }

      if (event.type === "observation" && event.step) {
        const paths = extractPaths(event.observation);
        recentFiles = Array.from(new Set([...paths, ...recentFiles])).slice(0, 24);
        steps = upsertStep(steps, event.step, {
          observation: event.observation,
          truncated: event.truncated,
          unifiedDiff: extractUnifiedDiff(event.observation),
          status: "completed"
        });
        trace = [
          ...trace,
          {
            id: crypto.randomUUID(),
            label: `step ${event.step} · completed`,
            detail: summarizeObservation(event.observation, 96),
            status: "done",
            time,
            type: traceType(event),
            iteration: eventIteration(event, trace)
          }
        ];
        const completedDeleteApproval = Object.values(approvals).find(
          (item) =>
            item.status === "approved" &&
            item.event.tool === "delete_files" &&
            item.event.step === event.step
        );
        if (completedDeleteApproval) {
          approvals = {
            ...approvals,
            [completedDeleteApproval.approvalId]: {
              ...completedDeleteApproval,
              status: event.observation?.includes("tool_error:")
                ? "execution_failed"
                : "executed"
            }
          };
        }
      }

      if (isApprovalRequired(event) && event.approvalId) {
        approvals = Object.fromEntries(
          Object.entries(approvals).map(([id, item]) => [
            id,
            item.status === "approved" && item.event.tool === event.tool && item.event.step === event.step
              ? { ...item, status: "expired" as const }
              : item
          ])
        );
        approvals = {
          ...approvals,
          [event.approvalId]: {
            approvalId: event.approvalId,
            status: "pending",
            event
          }
        };
        if (event.step) {
          steps = upsertStep(steps, event.step, {
            tool: event.tool,
            input: event.input,
            workspace: event.workspace,
            status: "blocked"
          });
        }
        nextStatus = "WAITING_APPROVAL";
        trace = [
          ...trace,
          {
            id: crypto.randomUUID(),
            label: "approval required",
            detail: traceDetail(event),
            status: "blocked",
            time,
            type: traceType(event),
            iteration: eventIteration(event, trace)
          }
        ];
      }

      if (event.type === "answer") {
        answer = event.answer;
        trace = [
          ...trace,
          {
            id: crypto.randomUUID(),
            label: "final answer",
            status: "done",
            time,
            type: traceType(event),
            iteration: eventIteration(event, trace)
          }
        ];
      }

      if (event.type === "done") {
        nextStatus = "COMPLETED";
        trace = [
          ...trace,
          {
            id: crypto.randomUUID(),
            label: "done",
            detail: traceDetail(event),
            status: "done",
            time,
            type: traceType(event),
            iteration: eventIteration(event, trace)
          }
        ];
      }

      if (event.type === "error") {
        nextStatus = "ERROR";
        error = event.message || event.code || "Agent stream error";
        trace = [
          ...trace,
          {
            id: crypto.randomUUID(),
            label: "error",
            detail: traceDetail(event),
            status: "error",
            time,
            type: traceType(event),
            iteration: eventIteration(event, trace)
          }
        ];
      }

      const nextState = {
        events,
        steps,
        plan,
        planTriggered,
        trace,
        approvals,
        recentFiles,
        status: nextStatus,
        answer,
        error,
        runId,
        requestId,
        conversationId,
        workspace
      };

      return {
        ...nextState,
        sessions: upsertSessionSnapshot(state.sessions, snapshotSession(state, nextState))
      };
    });
  },

  stopRun: () => {
    get().stream?.close();
    set({ status: "CANCELLED_LOCAL", statusMessage: "cancelled locally", stream: undefined });
  },

  decide: async (approvalId, decision, reason) => {
    const approval = get().approvals[approvalId];
    if (!approval) return;
    const decidingStatus = decision === "APPROVE" ? "approving" : "rejecting";
    set((state) => ({
      status: "RESUMING",
      approvals: {
        ...state.approvals,
        [approvalId]: { ...approval, status: decidingStatus }
      }
    }));

    try {
      const stream = openApprovalDecisionStream(approvalId, { decision, reason }, {
        onOpen: () =>
          set((state) => ({
            status: "RUNNING",
            statusMessage: "resumed",
            approvals: {
              ...state.approvals,
              [approvalId]: {
                ...(state.approvals[approvalId] || approval),
                status: decision === "APPROVE" ? "approved" : "rejected"
              }
            }
          })),
        onEvent: get().receiveEvent,
        onDisconnect: () => {
          const status = get().status;
          if (!["COMPLETED", "ERROR", "WAITING_APPROVAL", "CANCELLED_LOCAL"].includes(status)) {
            set({ status: "DISCONNECTED", statusMessage: "disconnected" });
          }
          if (["COMPLETED", "ERROR"].includes(status)) {
            setTimeout(() => get().refreshUndoAfterTerminal(), 100);
          }
        },
        onError: (error) =>
          set((state) => {
            const nextState = {
              status: "ERROR" as const,
              error: error.message,
              approvals: {
                ...state.approvals,
                [approvalId]: { ...approval, status: "pending" as const }
              }
            };
            return {
              ...nextState,
              sessions: upsertSessionSnapshot(state.sessions, snapshotSession(state, nextState))
            };
          })
      });
      set((state) => {
        const nextState = { stream };
        return {
          ...nextState,
          sessions: upsertSessionSnapshot(state.sessions, snapshotSession(state, nextState))
        };
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "审批失败";
      set({ status: "ERROR", error: message });
    }
  },

  loadUndo: async (runId) => {
    if (!runId) return;
    set((state) => ({
      undoByRunId: {
        ...state.undoByRunId,
        [runId]: { ...(state.undoByRunId[runId] || {}), loading: true, error: undefined, errorCode: undefined }
      }
    }));
    try {
      const response = await getRunUndo(runId);
      set((state) => ({
        undoByRunId: { ...state.undoByRunId, [runId]: { loading: false, executing: false, response } }
      }));
      if (response.status === "OPEN" || response.status === "SUSPENDED") {
        pollUndoUntilReady(runId);
      }
    } catch (error) {
      if (error instanceof FeatureMissingError) {
        set({ undoFeatureMissing: true });
        return;
      }
      const apiError = error instanceof ApiRequestError ? error : undefined;
      set((state) => ({
        undoByRunId: {
          ...state.undoByRunId,
          [runId]: {
            loading: false,
            executing: false,
            errorCode: apiError?.code,
            error: apiError?.info || (error instanceof Error ? error.message : "查询撤销状态失败")
          }
        }
      }));
    }
  },

  loadUndoStack: async (runIds) => {
    const unique = Array.from(new Set(runIds.filter(Boolean)));
    if (unique.length === 0) return;
    await Promise.allSettled(unique.map((id) => get().loadUndo(id)));
  },

  openUndoDialog: (runId) => {
    set({ undoDialogRunId: runId });
    void get().loadUndo(runId);
  },

  closeUndoDialog: () => {
    set({ undoDialogRunId: undefined });
  },

  confirmUndo: async (runId) => {
    const current = get().undoByRunId[runId];
    if (!current?.response || current.executing) return;
    const snapshotVersion = current.response.snapshotVersion;
    set((state) => ({
      undoByRunId: {
        ...state.undoByRunId,
        [runId]: { ...current, executing: true, error: undefined, errorCode: undefined }
      }
    }));
    try {
      const response = await undoRun(runId, { expectedSnapshotVersion: snapshotVersion });
      set((state) => {
        const nextUndo = {
          ...state.undoByRunId,
          [runId]: { loading: false, executing: false, response }
        };
        return {
          undoByRunId: nextUndo,
          undoDialogRunId: undefined,
          sessions: upsertSessionSnapshot(state.sessions, snapshotSession(state, { undoByRunId: nextUndo }))
        };
      });
      void get().resolveCurrentWorkspace();
      const state = get();
      const currentRunId = state.runId;
      const runHistoryIds = state.runHistory.map((r) => r.runId).filter(Boolean) as string[];
      const ids = currentRunId ? [currentRunId, ...runHistoryIds] : runHistoryIds;
      void get().loadUndoStack(ids);
    } catch (error) {
      const apiError = error instanceof ApiRequestError ? error : undefined;
      const errCode = apiError?.code || "undo_failed";
      const errMsg = (apiError?.code && undoErrorLabels[apiError.code]) || apiError?.info || (error instanceof Error ? error.message : "撤销失败");
      set((state) => {
        const nextUndo = {
          ...state.undoByRunId,
          [runId]: {
            ...(state.undoByRunId[runId] || {}),
            executing: false,
            errorCode: errCode,
            error: errMsg
          }
        };
        return {
          undoByRunId: nextUndo,
          sessions: upsertSessionSnapshot(state.sessions, snapshotSession(state, { undoByRunId: nextUndo }))
        };
      });
      if (errCode === "undo_not_latest") {
        const state = get();
        const currentRunId = state.runId;
        const runHistoryIds = state.runHistory.map((r) => r.runId).filter(Boolean) as string[];
        const ids = currentRunId ? [currentRunId, ...runHistoryIds] : runHistoryIds;
        void get().loadUndoStack(ids);
      }
    }
  },

  refreshUndoAfterTerminal: () => {
    const state = get();
    if (state.undoFeatureMissing) return;
    const currentRunId = state.runId;
    const runHistoryIds = state.runHistory.map((r) => r.runId).filter(Boolean) as string[];
    const ids = currentRunId ? [currentRunId, ...runHistoryIds] : runHistoryIds;
    void get().loadUndoStack(ids);
  }
}));
