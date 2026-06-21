import { create } from "zustand";
import {
  getWorkspaceTree,
  getModelConfig,
  openAgentAskStream,
  openApprovalDecisionStream,
  resolveWorkspace,
  type StreamHandle
} from "@/lib/api";
import { extractPaths, extractUnifiedDiff, formatTime } from "@/lib/utils";
import type {
  AgentApprovalDecisionRequest,
  AgentAskRequest,
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
  status: StepState["status"];
};

export type TraceItem = {
  id: string;
  label: string;
  detail?: string;
  time: string;
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
  maxSteps: number;
  prompt: string;
  events: TimelineEntry[];
  steps: StepState[];
  plan: PlanItem[];
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
  setMaxSteps: (maxSteps: number) => void;
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

function derivePlan(steps: StepState[]): PlanItem[] {
  return steps.map((step) => ({
    id: `step-${step.step}`,
    title: step.thought || step.tool || `Step ${step.step}`,
    status: step.status
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
  maxSteps: 6,
  prompt: "",
  events: [],
  steps: [],
  plan: [],
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
  setWorkspace: (workspace) =>
    set({
      workspace,
      workspaceDisplayName: undefined,
      workspaceMessage: undefined,
      workspaceTree: undefined,
      workspaceTreeError: undefined
    }),
  setMaxSteps: (maxSteps) => set({ maxSteps }),
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
      workspace: state.workspace || undefined
    };
    const sessions = [session, ...state.sessions.filter((item) => item.title !== session.title)].slice(0, 20);
    writeSessions(sessions);

    set({
      activeSessionId: session.id,
      sessions,
      status: "CONNECTING",
      statusMessage: "connecting",
      error: undefined,
      answer: undefined,
      events: [],
      steps: [],
      plan: [],
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
        maxSteps: state.maxSteps,
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
      let trace = state.trace;
      let approvals = state.approvals;
      let recentFiles = state.recentFiles;
      let nextStatus = state.status;
      let answer = state.answer;
      let error = state.error;
      let requestId = state.requestId;
      let conversationId = state.conversationId;
      let workspace = state.workspace;

      if (event.type === "meta") {
        requestId = event.requestId || requestId;
        conversationId = event.conversationId || conversationId;
        workspace = event.workspace || workspace;
        nextStatus = "RUNNING";
        trace = [
          ...trace,
          {
            id: crypto.randomUUID(),
            label: "meta",
            detail: event.requestId,
            time
          }
        ];
      }

      if (event.type === "node_start") {
        trace = [
          ...trace,
          {
            id: crypto.randomUUID(),
            label: event.node || "node",
            detail: event.nodeInputs?.join(", "),
            time
          }
        ];
      }

      if (event.type === "thought" && event.step) {
        steps = upsertStep(steps, event.step, {
          thought: event.thought,
          status: "running"
        });
      }

      if ((event.type === "tool_call" || event.type === "policy_denied") && event.step) {
        steps = upsertStep(steps, event.step, {
          tool: event.tool,
          input: event.input,
          workspace: event.workspace,
          status: event.type === "policy_denied" ? "failed" : "running"
        });
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
      }

      if (event.type === "answer") {
        answer = event.answer;
      }

      if (event.type === "done") {
        nextStatus = "COMPLETED";
      }

      if (event.type === "error") {
        nextStatus = "ERROR";
        error = event.message || event.code || "Agent stream error";
      }

      return {
        events,
        steps,
        plan: derivePlan(steps),
        trace,
        approvals,
        recentFiles,
        status: nextStatus,
        answer,
        error,
        requestId,
        conversationId,
        workspace
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
