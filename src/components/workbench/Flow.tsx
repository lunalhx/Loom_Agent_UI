import { AlertTriangle, CheckCircle2, FileDiff } from "lucide-react";
import { useState } from "react";
import { useAgentStore } from "@/store/agentStore";
import type { AgentStreamEvent } from "@/types/backend";
import { AnswerMarkdown } from "./AnswerMarkdown";
import { DiffApprovalCard } from "./DiffApprovalCard";

const emptyPrompts = [
  { icon: "⌕", tone: "blue", label: "解释这个项目的整体架构和模块职责", prompt: "解释这个项目的整体架构和模块职责" },
  { icon: "✎", tone: "green", label: "给 domain 模块补充单元测试", prompt: "给 Loom_Agent-domain 模块补充单元测试" },
  { icon: "⚑", tone: "orange", label: "找出所有调用了废弃 API 的位置", prompt: "找出项目里所有调用了废弃 API 的位置" }
];

const loadingLabels = ["Weaving", "Threading", "Spinning up", "On the loom"] as const;

function shuffledLoadingLabels() {
  const labels = [...loadingLabels];
  for (let index = labels.length - 1; index > 0; index--) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [labels[index], labels[swapIndex]] = [labels[swapIndex], labels[index]];
  }
  return labels;
}

function workspaceLabel(workspace?: string, displayName?: string) {
  if (displayName) return displayName;
  if (!workspace) return "java/Loom_Agent_UI";
  const parts = workspace.split(/[\\/]/).filter(Boolean);
  return parts.slice(-2).join("/") || workspace;
}

function EmptyWelcomeState() {
  const workspace = useAgentStore((state) => state.workspace);
  const workspaceDisplayName = useAgentStore((state) => state.workspaceDisplayName);
  const setPrompt = useAgentStore((state) => state.setPrompt);

  return (
    <div className="flex min-h-[430px] flex-col items-center justify-center px-6 py-8 text-white/85">
        <div className="empty-loom mb-5" aria-hidden="true">
          <svg width="60" height="60" viewBox="0 0 60 60" fill="none">
            <line className="empty-loom-warp" x1="14" y1="8" x2="14" y2="52" />
            <line className="empty-loom-warp" x1="23" y1="8" x2="23" y2="52" />
            <line className="empty-loom-warp" x1="32" y1="8" x2="32" y2="52" />
            <line className="empty-loom-warp" x1="41" y1="8" x2="41" y2="52" />
            <line className="empty-loom-warp" x1="50" y1="8" x2="50" y2="52" />
            <line className="empty-loom-weft empty-loom-w1" x1="10" y1="20" x2="54" y2="20" />
            <line className="empty-loom-weft empty-loom-w2" x1="10" y1="32" x2="54" y2="32" />
            <line className="empty-loom-weft empty-loom-w3" x1="10" y1="44" x2="54" y2="44" />
          </svg>
        </div>
        <div className="mb-1.5 text-[17px] font-semibold tracking-normal text-white/90">开始编织你的代码</div>
        <div className="mb-1 text-xs text-white/45">描述一个任务，Loom 会规划、调用工具并改写代码</div>
        <div className="mb-6 font-mono text-[11px] text-primary/70">↳ {workspaceLabel(workspace, workspaceDisplayName)}</div>
        <div className="mb-3 text-[10px] uppercase tracking-[0.7px] text-white/30">试试这些</div>
        <div className="flex w-full max-w-[430px] flex-col gap-2">
          {emptyPrompts.map((item) => (
            <button
              key={item.prompt}
              type="button"
              className="empty-chip flex items-center gap-3 rounded-[10px] border border-white/10 bg-white/[0.03] px-3.5 py-3 text-left transition hover:border-primary/30 hover:bg-primary/10"
              onClick={() => setPrompt(item.prompt)}
            >
              <span className={`empty-chip-icon empty-chip-${item.tone}`}>{item.icon}</span>
              <span className="min-w-0 flex-1 text-[12.5px] leading-snug text-white/80">{item.label}</span>
              <span className="shrink-0 text-sm text-white/25">↗</span>
            </button>
          ))}
        </div>
    </div>
  );
}

function MiniLoomLoader({ onShuttlePass }: { onShuttlePass: () => void }) {
  return (
    <div className="mini-loom" aria-hidden="true">
      <span className="mini-loom-warp mini-loom-warp-1" />
      <span className="mini-loom-warp mini-loom-warp-2" />
      <span className="mini-loom-warp mini-loom-warp-3" />
      <span className="mini-loom-weft mini-loom-weft-1" />
      <span className="mini-loom-weft mini-loom-weft-2" />
      <span className="mini-loom-shuttle" onAnimationIteration={onShuttlePass} />
    </div>
  );
}

function LoadingBubble() {
  const [labels] = useState(shuffledLoadingLabels);
  const [labelIndex, setLabelIndex] = useState(0);

  return (
    <div className="flex justify-start">
      <div className="flex max-w-[82%] items-center gap-3 rounded-[14px] border border-white/10 bg-[#1a1b1d] px-3.5 py-3 text-[13px] text-white/52 shadow-insetline">
        <MiniLoomLoader onShuttlePass={() => setLabelIndex((index) => (index + 1) % labels.length)} />
        <span aria-live="polite">{labels[labelIndex]}</span>
      </div>
    </div>
  );
}

function UserMessage({ prompt }: { prompt: string }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[82%] rounded-[16px] rounded-br-[5px] border border-[rgba(243,160,76,.28)] bg-[rgba(243,160,76,.16)] px-4 py-3 text-[14px] leading-6 text-white/92 shadow-insetline">
        {prompt}
      </div>
    </div>
  );
}

type ProcessRow = {
  id: string;
  description: string;
  type: "planner" | "tool_call" | "result";
};

function AgentStepsCard() {
  const steps = useAgentStore((state) => state.steps);
  const rows = steps.flatMap<ProcessRow>((step) => {
    const next: ProcessRow[] = [];
    if (step.thought) {
      next.push({ id: `${step.step}-thought`, description: step.thought, type: "planner" });
    }
    if (step.tool) {
      next.push({ id: `${step.step}-tool`, description: `执行工具 ${step.tool}`, type: "tool_call" });
    }
    if (step.observation) {
      next.push({ id: `${step.step}-result`, description: `步骤 ${step.step} 已完成`, type: "result" });
    }
    return next;
  });

  if (!rows.length) return null;

  return (
    <div className="flex justify-start">
      <div className="w-full max-w-[820px] overflow-hidden rounded-[14px] border border-white/[0.08] bg-white/[0.022]">
        <div className="border-b border-white/[0.06] px-3.5 py-2.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-white/34">
          Agent 执行过程
        </div>
        <div className="divide-y divide-white/[0.055]">
          {rows.map((row) => (
            <div key={row.id} className="grid grid-cols-[8px_minmax(0,1fr)_auto] items-center gap-2.5 px-3.5 py-2.5">
              <span
                className={`h-2 w-2 rounded-full ${
                  row.type === "planner" ? "bg-[#F3A04C]" : row.type === "tool_call" ? "bg-[#2DBBA0]" : "bg-[#5BBF5B]"
                }`}
              />
              <span className="min-w-0 truncate text-[12.5px] text-white/62" title={row.description}>
                {row.description}
              </span>
              <span className="rounded-full border border-white/[0.07] bg-white/[0.035] px-2 py-0.5 font-mono text-[9.5px] text-white/32">
                {row.type}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function EventMarker({ event }: { event: AgentStreamEvent }) {
  if (event.type === "policy_denied") {
    return (
      <div className="flex justify-start">
        <div className="max-w-[82%] rounded-[12px] border border-red-500/35 bg-red-950/20 p-3">
          <div className="mb-1 flex items-center gap-2 font-mono text-sm text-red-300">
            <AlertTriangle size={15} />
            policy_denied
          </div>
          <div className="text-sm text-muted-foreground">{event.riskReason}</div>
        </div>
      </div>
    );
  }

  if (event.type === "error") {
    return (
      <div className="flex justify-start">
        <div className="max-w-[82%] rounded-[12px] border border-red-500/35 bg-red-950/20 p-3">
          <div className="mb-1 flex items-center gap-2 font-mono text-sm text-red-300">
            <AlertTriangle size={15} />
            error
          </div>
          <div className="text-sm text-muted-foreground">{event.message || event.code}</div>
        </div>
      </div>
    );
  }

  return null;
}

export function Flow() {
  const activeSessionId = useAgentStore((state) => state.activeSessionId);
  const submittedPrompt = useAgentStore((state) => state.submittedPrompt);
  const status = useAgentStore((state) => state.status);
  const steps = useAgentStore((state) => state.steps);
  const approvals = useAgentStore((state) => state.approvals);
  const answer = useAgentStore((state) => state.answer);
  const error = useAgentStore((state) => state.error);
  const events = useAgentStore((state) => state.events);
  const trace = useAgentStore((state) => state.trace);
  const approvalList = Object.values(approvals);
  const activeRun = status !== "IDLE";
  const hasRunContent = activeRun || steps.length > 0 || approvalList.length > 0 || Boolean(answer) || Boolean(error);
  const showPromptMessage = Boolean(submittedPrompt?.trim()) && hasRunContent;
  const showLoading = ["CONNECTING", "RUNNING", "RESUMING"].includes(status) && !answer && !error;
  const isEmpty = !hasRunContent;
  const elapsedMs = events.reduce((max, entry) => Math.max(max, entry.event.elapsedMs || 0), 0);
  const iterationCount = new Set(trace.map((item) => item.iteration)).size || steps.length;
  const toolCallCount = events.filter((entry) => entry.event.type === "tool_call").length;

  return (
    <main className="min-h-0 flex-1 overflow-auto bg-[#090b0d]">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-5">
        {showPromptMessage ? <UserMessage prompt={submittedPrompt!} /> : null}

        {isEmpty ? <EmptyWelcomeState /> : null}

        {approvalList.map((approval) => (
          <DiffApprovalCard key={approval.approvalId} approval={approval} />
        ))}

        <AgentStepsCard />

        {showLoading ? <LoadingBubble key={activeSessionId || submittedPrompt} /> : null}

        {events.map(({ id, event }) => (
          <EventMarker key={id} event={event} />
        ))}

        {answer ? (
          <div className="flex justify-start">
            <div className="relative w-full max-w-[920px] overflow-hidden rounded-[18px] border border-primary/25 bg-[linear-gradient(180deg,rgba(243,160,76,.075),rgba(243,160,76,.018))] p-5 shadow-insetline">
              <span className="absolute inset-y-0 left-0 w-[3px] bg-gradient-to-b from-[#F3A04C] to-[#E58522]" />
              <div className="mb-3 flex items-center gap-2 text-[12px] font-semibold text-primary">
                <CheckCircle2 size={15} />
                最终回答
              </div>
              <div className="text-[15px] leading-7 text-foreground">
                <AnswerMarkdown content={answer} />
              </div>
              <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 border-t border-white/[0.075] pt-3 font-mono text-[10.5px] text-white/34">
                <span>耗时 {elapsedMs ? `${(elapsedMs / 1000).toFixed(1)}s` : "—"}</span>
                <span>{iterationCount} 次迭代</span>
                <span>{toolCallCount} 次工具调用</span>
              </div>
            </div>
          </div>
        ) : null}

        {error ? (
          <div className="flex justify-start">
            <div className="max-w-[82%] rounded border border-red-500/35 bg-red-950/20 p-3">
              <div className="mb-1 flex items-center gap-2 font-mono text-sm text-red-300">
                <FileDiff size={15} />
                run error
              </div>
              <div className="text-sm text-muted-foreground">{error}</div>
            </div>
          </div>
        ) : null}
      </div>
    </main>
  );
}
