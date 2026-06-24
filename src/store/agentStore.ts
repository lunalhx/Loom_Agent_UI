import { create } from "zustand";
import {
  getWorkspaceTree,
  getModelConfig,
  openAgentAskStream,
  openApprovalDecisionStream,
  resolveWorkspace,
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
  AgentWorkspaceTreeNode,
  ModelConfigResponse,
  RunStatus
} from "@/types/backend";

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
};

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
  status: "pending" | "approving" | "approved" | "rejecting" | "rejected" | "expired";
  event: AgentStreamEvent;
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

const defaultModels = ["deepseek-v4-flash", "deepseek-v4-pro"];

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
  selectedLocalFile?: LocalFileTarget;
  selectedLocalFolder?: LocalFolderTarget;
  answer?: string;
  error?: string;
  usage?: { promptTokens?: number; completionTokens?: number; totalTokens?: number; costUsd?: number };
  sessions: Session[];
  stream?: StreamHandle;
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
  startRun: () => Promise<void>;
  replayMock: (sequence: AgentStreamEvent[]) => void;
  receiveEvent: (event: AgentStreamEvent) => void;
  stopRun: () => void;
  decide: (approvalId: string, decision: AgentApprovalDecisionRequest["decision"], reason?: string) => Promise<void>;
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
    error
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

function traceDetail(event: AgentStreamEvent) {
  if (event.type === "node_start") return event.nodeInputs?.join(", ");
  if (event.type === "checkpoint_saved") return event.checkpointVersion ? `checkpoint v${event.checkpointVersion}` : "checkpoint saved";
  if (event.type === "resume_started") return event.approvalId ? `approval ${event.approvalId}` : "resume started";
  if (event.type.startsWith("sub_agent")) return event.subAgentSummary || event.subAgentRole || event.subAgentId;
  if (event.type === "plan_updated") return event.plan?.summary || `${event.plan?.items.length ?? 0} items`;
  if (event.type === "replan_started") return event.plan?.summary || "replanning";
  if (event.type === "done") return event.stopReason;
  if (event.type === "error") return event.message || event.code;
  if (event.type === "approval_required") return event.operationPreview || event.riskReason;
  return undefined;
}

function traceStatus(event: AgentStreamEvent) {
  if (event.type === "error" || event.type === "sub_agent_failed") return "error";
  if (event.type === "done" || event.type === "sub_agent_completed" || event.type === "checkpoint_saved") return "done";
  if (event.type === "approval_required") return "blocked";
  if (event.type === "replan_started" || event.type === "resume_started" || event.type === "sub_agent_started") return "running";
  return undefined;
}

function traceType(event: AgentStreamEvent, fallback?: string) {
  if (event.traceNodeType) return event.traceNodeType;
  if (event.type === "node_start") return event.node || fallback || "meta";
  if (event.type === "tool_call" || event.type === "policy_denied" || event.type === "approval_required") return "tool_call";
  if (event.type === "plan_updated" || event.type === "replan_started") return "plan_updated";
  if (event.type === "answer" || event.type === "done") return "final_answer";
  if (event.type === "thought") return "planner";
  if (event.type === "meta") return "meta";
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
  sessions: typeof localStorage === "undefined" ? [] : readSessions(),

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
        selectedLocalFile: undefined,
        selectedLocalFolder: undefined,
        stream: undefined
      };
    }),
  selectSession: (sessionId) =>
    set((state) => {
      const session = state.sessions.find((item) => item.id === sessionId);
      if (!session) return {};
      state.stream?.close();
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

  startRun: async () => {
    const state = get();
    const prompt = state.prompt.trim();
    if (!prompt) {
      set({ status: "ERROR", error: "question 不能为空" });
      return;
    }

    state.stream?.close();
    const createdAt = new Date().toISOString();
    const session: Session = {
      id: crypto.randomUUID(),
      title: titleFromPrompt(prompt),
      createdAt,
      updatedAt: createdAt,
      workspace: state.workspace || undefined,
      prompt,
      status: "CONNECTING",
      events: [],
      steps: [],
      plan: [],
      planTriggered: false,
      trace: [],
      approvals: {},
      recentFiles: []
    };
    const sessions = [session, ...state.sessions.filter((item) => item.title !== session.title)].slice(0, 20);
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
      recentFiles: []
    });

    try {
      const message = await promptWithAttachment(prompt, state.selectedLocalFile);
      const request: AgentAskRequest = {
        question: message,
        message,
        workspace: state.workspace || undefined,
        includeTrace: true
      };
      const stream = openAgentAskStream(request, {
        onOpen: () => set({ status: "RUNNING", statusMessage: "connected" }),
        onEvent: get().receiveEvent,
        onDisconnect: () => {
          const status = get().status;
          if (!["COMPLETED", "ERROR", "WAITING_APPROVAL", "CANCELLED_LOCAL"].includes(status)) {
            set({ status: "DISCONNECTED", statusMessage: "disconnected" });
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
        event.type === "sub_agent_summary"
      ) {
        trace = [
          ...trace,
          {
            id: crypto.randomUUID(),
            label: event.node || event.subAgentName || event.type,
            detail: traceDetail(event),
            status: traceStatus(event),
            time,
            type: traceType(event),
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
      }

      if (event.type === "approval_required" && event.approvalId) {
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
        onOpen: () => set({ status: "RUNNING", statusMessage: "resumed" }),
        onEvent: get().receiveEvent,
        onDisconnect: () => {
          const status = get().status;
          if (!["COMPLETED", "ERROR", "WAITING_APPROVAL", "CANCELLED_LOCAL"].includes(status)) {
            set({ status: "DISCONNECTED", statusMessage: "disconnected" });
          }
        },
        onError: (error) => set({ status: "ERROR", error: error.message })
      });
      set((state) => ({
        stream,
        approvals: {
          ...state.approvals,
          [approvalId]: {
            ...approval,
            status: decision === "APPROVE" ? "approved" : "rejected"
          }
        }
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : "审批失败";
      set({ status: "ERROR", error: message });
    }
  }
}));
