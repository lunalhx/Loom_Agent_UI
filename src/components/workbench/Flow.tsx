import { useState } from "react";
import { AlertTriangle, Bot, ChevronDown, ChevronRight, FileDiff, FileText, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { basename, clipMultiline, cn, isWriteTool, summarizeParams, tryStringify } from "@/lib/utils";
import { useAgentStore, type StepState } from "@/store/agentStore";
import type { AgentStreamEvent, DiffPayload } from "@/types/backend";
import { AnswerMarkdown } from "./AnswerMarkdown";
import { CodeDiffPanel } from "./CodeDiffPanel";
import { DiffApprovalCard } from "./DiffApprovalCard";

const emptyPrompts = [
  { icon: "⌕", tone: "blue", label: "解释这个项目的整体架构和模块职责", prompt: "解释这个项目的整体架构和模块职责" },
  { icon: "✎", tone: "green", label: "给 domain 模块补充单元测试", prompt: "给 Loom_Agent-domain 模块补充单元测试" },
  { icon: "⚑", tone: "orange", label: "找出所有调用了废弃 API 的位置", prompt: "找出项目里所有调用了废弃 API 的位置" }
];

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
    <div className="rounded-2xl border border-white/10 bg-[#1a1b1d] text-white/85">
      <div className="flex min-h-[430px] flex-col items-center justify-center px-6 py-8">
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
    </div>
  );
}

function MiniLoomLoader() {
  return (
    <div className="mini-loom" aria-hidden="true">
      <span className="mini-loom-warp mini-loom-warp-1" />
      <span className="mini-loom-warp mini-loom-warp-2" />
      <span className="mini-loom-warp mini-loom-warp-3" />
      <span className="mini-loom-weft mini-loom-weft-1" />
      <span className="mini-loom-weft mini-loom-weft-2" />
      <span className="mini-loom-shuttle" />
    </div>
  );
}

function LoadingBubble({ label }: { label: string }) {
  return (
    <div className="flex justify-start">
      <div className="flex max-w-[82%] items-center gap-3 rounded-[14px] border border-white/10 bg-[#1a1b1d] px-3.5 py-3 text-[13px] text-white/52 shadow-insetline">
        <MiniLoomLoader />
        <span>{label}</span>
      </div>
    </div>
  );
}

function inputPath(input?: Record<string, unknown>) {
  const path = input?.path ?? input?.file ?? input?.filename;
  return typeof path === "string" ? path : undefined;
}

function ToolCallChip({ step }: { step: StepState }) {
  if (!step.tool) return null;
  const filePath = inputPath(step.input);
  const params = summarizeParams(step.input);
  const label = filePath ? basename(filePath) : params || step.workspace || "workspace";
  const writeTool = isWriteTool(step.tool);

  return (
    <div className="flex justify-start">
      <div className="inline-flex max-w-full items-center gap-2 rounded-[10px] border border-white/10 bg-[#242628] px-3 py-2 text-[13px] text-white/70">
        {writeTool ? <FileText className="shrink-0 text-emerald-300" size={15} /> : <Wrench className="shrink-0 text-sky-300" size={15} />}
        <span
          className={cn(
            "shrink-0 rounded-md px-2 py-0.5 font-mono text-[11px] font-semibold",
            writeTool ? "bg-emerald-400/15 text-emerald-200" : "bg-sky-400/15 text-sky-200"
          )}
        >
          {step.tool}
        </span>
        <span className="min-w-0 truncate font-mono">{label}</span>
      </div>
    </div>
  );
}

function StepDetails({ step, hideObservation = false }: { step: StepState; hideObservation?: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const [showFullObservation, setShowFullObservation] = useState(false);
  const clippedObservation = step.observation ? clipMultiline(step.observation) : undefined;
  const observationText = showFullObservation ? step.observation : clippedObservation?.text;
  const hasDetails = step.input || (step.observation && !hideObservation);

  if (!hasDetails) return null;

  return (
    <div className="pl-1">
      <button
        type="button"
        className="inline-flex items-center gap-1.5 rounded-md px-1.5 py-1 font-mono text-[11px] text-white/34 transition hover:bg-white/[0.04] hover:text-white/58"
        onClick={() => setExpanded((value) => !value)}
      >
        {expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        原始记录 · step {step.step} · {step.status}
      </button>

      {expanded ? (
        <div className="mt-2 space-y-2 rounded-[10px] border border-white/10 bg-[#0b0d0f] p-3">
          {step.input ? (
            <pre className="max-h-44 overflow-auto rounded border border-white/10 bg-[#080a0c] p-3 font-mono text-xs text-white/48">
              {tryStringify(step.input)}
            </pre>
          ) : null}

          {step.observation && !hideObservation ? (
            <div>
              <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded border border-white/10 bg-[#080a0c] p-3 font-mono text-xs leading-5 text-white/48">
                {observationText}
              </pre>
              <div className="mt-2 flex items-center justify-between gap-2">
                {step.truncated ? <div className="font-mono text-[11px] text-primary">truncated</div> : <span />}
                {clippedObservation?.clipped ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 font-mono text-[11px] text-white/45"
                    onClick={() => setShowFullObservation((value) => !value)}
                  >
                    {showFullObservation ? "收起全部" : "展开全部"}
                  </Button>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function AssistantStepMessage({ step }: { step: StepState }) {
  const filePath = inputPath(step.input);
  const diff = step.unifiedDiff
    ? ({
        format: "UNIFIED",
        path: filePath || "changes.diff",
        unifiedDiff: step.unifiedDiff,
        editable: false
      } satisfies DiffPayload)
    : undefined;

  return (
    <div className="space-y-2">
      {step.thought ? (
        <div className="flex justify-start">
          <div className="max-w-[82%] rounded-[14px] border border-white/10 bg-[#1a1b1d] px-4 py-3 shadow-insetline">
            <div className="flex gap-2 text-[13px] italic leading-6 text-white/45">
              <span className="shrink-0 font-semibold not-italic text-white/30">思考</span>
              <span>{step.thought}</span>
            </div>
          </div>
        </div>
      ) : null}

      <ToolCallChip step={step} />

      {diff ? (
        <div className="flex justify-start">
          <div className="w-full max-w-[920px]">
            <CodeDiffPanel diff={diff} path={filePath} />
          </div>
        </div>
      ) : null}

      <StepDetails step={step} hideObservation={Boolean(diff)} />
    </div>
  );
}

function UserMessage({ prompt }: { prompt: string }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[78%] rounded-[14px] border border-primary/30 bg-primary/15 px-4 py-3 text-[14px] font-semibold leading-6 text-white/88 shadow-insetline">
        {prompt}
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
  const prompt = useAgentStore((state) => state.prompt);
  const status = useAgentStore((state) => state.status);
  const steps = useAgentStore((state) => state.steps);
  const approvals = useAgentStore((state) => state.approvals);
  const answer = useAgentStore((state) => state.answer);
  const error = useAgentStore((state) => state.error);
  const events = useAgentStore((state) => state.events);
  const approvalList = Object.values(approvals);
  const activeRun = status !== "IDLE";
  const hasRunContent = activeRun || steps.length > 0 || approvalList.length > 0 || Boolean(answer) || Boolean(error);
  const showPromptMessage = Boolean(prompt.trim()) && hasRunContent;
  const showLoading = ["CONNECTING", "RUNNING", "RESUMING"].includes(status) && !answer && !error;
  const isEmpty = !hasRunContent;

  return (
    <main className="min-h-0 flex-1 overflow-auto bg-[#090b0d]">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-5">
        {showPromptMessage ? <UserMessage prompt={prompt} /> : null}

        {isEmpty ? <EmptyWelcomeState /> : null}

        {steps.map((step) => (
          <AssistantStepMessage key={step.step} step={step} />
        ))}

        {approvalList.map((approval) => (
          <DiffApprovalCard key={approval.approvalId} approval={approval} />
        ))}

        {showLoading ? <LoadingBubble label={steps.length === 0 ? "正在连接 coding agent..." : "正在继续处理..."} /> : null}

        {events.map(({ id, event }) => (
          <EventMarker key={id} event={event} />
        ))}

        {answer ? (
          <div className="flex justify-start">
            <div className="max-w-[920px] rounded-[14px] border border-primary/25 bg-[#17120c] p-4 shadow-insetline">
              <div className="mb-3 flex items-center gap-2 font-mono text-xs text-primary">
                <Bot size={14} />
                Final answer
              </div>
              <div className="text-[15px] leading-7 text-foreground">
                <AnswerMarkdown content={answer} />
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
