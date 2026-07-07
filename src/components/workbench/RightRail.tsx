import { Check, ChevronDown, Clock3, Loader2, MoveRight, RefreshCw, RotateCcw, Undo2, X } from "lucide-react";
import { useMemo, useState } from "react";
import { cn, formatBytes, backgroundTaskStatusLabel } from "@/lib/utils";
import { useAgentStore, type BackgroundTaskState, type PlanItem, type TraceItem, type UndoViewState } from "@/store/agentStore";
import type { UndoChangedFile } from "@/types/backend";

function PlanIcon({ status }: { status: PlanItem["status"] }) {
  if (status === "done") {
    return (
      <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-[5px] bg-[#5BBF5B]/20 text-[#73D173]">
        <Check size={11} strokeWidth={2.5} />
      </span>
    );
  }

  if (status === "doing") {
    return (
      <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-[5px] bg-primary/20 text-primary">
        <MoveRight size={11} strokeWidth={2.5} />
      </span>
    );
  }

  return (
    <span
      className={cn(
        "mt-0.5 h-4 w-4 shrink-0 rounded-[5px] border",
        status === "blocked" ? "border-red-400/55 bg-red-400/10" : "border-white/25 bg-white/[0.02]"
      )}
    />
  );
}

function traceDotColor(type: string) {
  if (type === "planner") return "bg-[#F3A04C]";
  if (type === "model_call") return "bg-[#B481BB]";
  if (type === "tool_call" || type === "tool_dispatch") return "bg-[#2DBBA0]";
  if (type === "plan_updated" || type === "final_answer") return "bg-[#5BBF5B]";
  return "bg-white/35";
}

function traceStage(items: TraceItem[]) {
  const types = new Set(items.map((item) => item.type));
  if (types.has("tool_call") || types.has("tool_dispatch")) return "推理 / 工具";
  if (types.has("planner") || types.has("plan_updated")) return "规划阶段";
  if (types.has("final_answer")) return "收尾";
  return "Agent loop";
}

function TraceGroup({ iteration, items }: { iteration: number; items: TraceItem[] }) {
  const [open, setOpen] = useState(true);

  return (
    <div className="overflow-hidden rounded-[12px] border border-white/[0.07] bg-white/[0.018]">
      <button
        type="button"
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left transition hover:bg-white/[0.035]"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <ChevronDown className={cn("text-white/35 transition-transform", !open && "-rotate-90")} size={14} />
        <span className="text-[12px] font-semibold text-white/72">循环 #{iteration}</span>
        <span className="ml-auto rounded-full bg-white/[0.055] px-2 py-0.5 text-[10px] text-white/38">{traceStage(items)}</span>
      </button>

      {open ? (
        <div className="px-3 pb-3 pl-5">
          {items.map((item, index) => (
            <div key={item.id} className="relative grid grid-cols-[minmax(0,1fr)_58px] items-center gap-2 py-1.5 pl-4">
              <span
                className={cn(
                  "absolute left-[3px] w-px bg-white/[0.09]",
                  index === 0 ? "top-1/2 bottom-0" : index === items.length - 1 ? "top-0 bottom-1/2" : "inset-y-0"
                )}
              />
              <span
                className={cn(
                  "absolute left-0 top-1/2 h-[7px] w-[7px] -translate-y-1/2 rounded-full ring-[3px] ring-[#151517]",
                  traceDotColor(item.type)
                )}
              />
              <span className="min-w-0 truncate font-mono text-[11px] text-white/58" title={item.detail || item.label}>
                {item.label}
              </span>
              <time className="text-right font-mono text-[10px] tabular-nums text-white/28">{item.time}</time>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

type RightTab = "trace" | "changes" | "tasks";

const changeTypeTag: Record<string, { label: string; color: string }> = {
  ADDED: { label: "A", color: "text-emerald-400" },
  MODIFIED: { label: "M", color: "text-primary" },
  DELETED: { label: "D", color: "text-red-400" },
  RENAMED: { label: "R", color: "text-sky-400" },
  TYPE_CHANGED: { label: "T", color: "text-white/45" }
};

function undoStatusBadge(status: string) {
  switch (status) {
    case "OPEN":
      return { label: "生成撤销点", color: "text-white/40 bg-white/[0.05]" };
    case "SUSPENDED":
      return { label: "等待中", color: "text-amber-400 bg-amber-400/10" };
    case "READY":
      return { label: "可撤销", color: "text-emerald-400 bg-emerald-400/10" };
    case "NO_CHANGES":
      return { label: "无修改", color: "text-white/35 bg-white/[0.04]" };
    case "UNDONE":
      return { label: "已撤销", color: "text-emerald-400 bg-emerald-400/10" };
    case "UNAVAILABLE":
      return { label: "不可撤销", color: "text-amber-400 bg-amber-400/10" };
    case "EXPIRED":
      return { label: "已过期", color: "text-white/30 bg-white/[0.03]" };
    case "FAILED":
      return { label: "失败", color: "text-red-400 bg-red-400/10" };
    default:
      return { label: status, color: "text-white/35 bg-white/[0.04]" };
  }
}

function fileDisplayName(file: UndoChangedFile) {
  if (file.changeType === "RENAMED" && file.oldPath) {
    return { display: `${file.oldPath} → ${file.path}`, isLong: true };
  }
  return { display: file.path, isLong: false };
}

function ChangesPanel({ viewState, runId }: { viewState?: UndoViewState; runId?: string }) {
  const openUndoDialog = useAgentStore((state) => state.openUndoDialog);
  const loadUndo = useAgentStore((state) => state.loadUndo);
  const undoFeatureMissing = useAgentStore((state) => state.undoFeatureMissing);

  if (undoFeatureMissing) {
    return (
      <div className="flex min-h-[200px] flex-col items-center justify-center rounded-[14px] border border-dashed border-white/[0.1] bg-white/[0.015] px-4 text-center">
        <span className="mb-3 text-white/25">
          <RotateCcw size={17} strokeWidth={1.7} />
        </span>
        <div className="text-[12px] font-medium text-white/45">撤销功能不可用</div>
        <div className="mt-1.5 text-[10.5px] leading-4 text-white/28">后端暂未部署撤销接口</div>
      </div>
    );
  }

  if (!runId) {
    return (
      <div className="flex min-h-[200px] flex-col items-center justify-center rounded-[14px] border border-dashed border-white/[0.1] bg-white/[0.015] px-4 text-center">
        <span className="mb-3 flex h-9 w-9 items-center justify-center rounded-full bg-white/[0.045] text-white/35">
          <RotateCcw size={17} strokeWidth={1.7} />
        </span>
        <div className="text-[12px] font-medium text-white/55">暂无活动 run</div>
        <div className="mt-1.5 text-[10.5px] leading-4 text-white/28">完成一次 Agent 任务后将展示撤销信息</div>
      </div>
    );
  }

  if (!viewState?.response && !viewState?.loading) {
    return (
      <div className="flex min-h-[200px] flex-col items-center justify-center rounded-[14px] border border-dashed border-white/[0.1] bg-white/[0.015] px-4 text-center">
        <span className="mb-3 text-white/30">
          <RotateCcw size={17} strokeWidth={1.7} />
        </span>
        <div className="text-[12px] font-medium text-white/45">撤销信息不可用</div>
        <button
          type="button"
          className="mt-2.5 rounded-full border border-white/[0.1] bg-white/[0.04] px-3 py-1 text-[11px] text-primary/70 transition hover:border-primary/25"
          onClick={() => void loadUndo(runId)}
        >
          重新查询
        </button>
      </div>
    );
  }

  if (viewState.loading) {
    return (
      <div className="flex min-h-[200px] items-center justify-center rounded-[14px] border border-dashed border-white/[0.1] bg-white/[0.015]">
        <span className="inline-flex items-center gap-2 text-[12px] text-white/38">
          <Loader2 size={14} className="animate-spin" />
          查询撤销状态
        </span>
      </div>
    );
  }

  const response = viewState.response!;
  const badge = undoStatusBadge(response.status);
  const files = response.changedFiles || [];
  const totalCount = response.changedFileCount || files.length;
  const showUndoButton = response.status === "READY" && response.canUndo;

  return (
    <div className="flex flex-1 flex-col min-h-0 space-y-3">
      <div className="flex items-center gap-2">
        <span className={`rounded-full px-2.5 py-0.5 font-mono text-[10px] font-semibold ${badge.color}`}>
          {badge.label}
        </span>
        {response.expiresAt ? (
          <span className="ml-auto font-mono text-[10px] text-white/28" title={response.expiresAt}>
            过期: {new Date(response.expiresAt).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}
          </span>
        ) : null}
      </div>

      {response.reason ? (
        <div className="rounded-[10px] border border-white/[0.06] bg-white/[0.018] px-3 py-2 text-[11.5px] leading-5 text-white/45">
          {response.reason}
        </div>
      ) : null}

      {viewState.error ? (
        <div className="rounded-[10px] border border-red-400/25 bg-red-400/[0.06] px-3 py-2.5">
          <div className="text-[11.5px] leading-5 text-red-300/80">{viewState.error}</div>
          <button
            type="button"
            className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-white/[0.1] bg-white/[0.04] px-2.5 py-1 text-[10.5px] text-white/55 transition hover:border-primary/25 hover:text-primary"
            onClick={() => void loadUndo(runId)}
          >
            <RotateCcw size={11} />
            重新查询
          </button>
        </div>
      ) : null}

      {files.length > 0 ? (
        <>
          <div className="flex items-center text-[11px] text-white/40">
            <span className="font-semibold uppercase tracking-[0.06em]">
              文件 ({totalCount})
            </span>
            {response.changedBytes !== undefined ? (
              <span className="ml-2 font-mono">
                · {response.changedBytes > 1024 ? `${(response.changedBytes / 1024).toFixed(1)} KB` : `${response.changedBytes} B`}
              </span>
            ) : null}
          </div>
          <ul className="min-h-0 flex-1 space-y-1 overflow-auto pr-0.5">
            {files.map((file, index) => {
              const info = changeTypeTag[file.changeType] || { label: "?", color: "text-white/40" };
              const { display } = fileDisplayName(file);
              return (
                <li
                  key={`${file.path}-${index}`}
                  className="flex min-w-0 items-center gap-2 rounded-md px-2 py-1.5 hover:bg-white/[0.035]"
                  title={display}
                >
                  <span className={`shrink-0 rounded px-1.5 py-0.5 font-mono text-[10px] font-bold ${info.color} bg-white/[0.05]`}>
                    {info.label}
                  </span>
                  <span className="truncate font-mono text-[11px] text-white/58">{file.path}</span>
                </li>
              );
            })}
          </ul>
        </>
      ) : totalCount > 0 ? null : (
        <div className="text-[11px] text-white/28">暂无文件变更</div>
      )}

      <div className="shrink-0 border-t border-white/[0.06] pt-3">
        {showUndoButton ? (
          <button
            type="button"
            className="flex w-full items-center justify-center gap-2 rounded-[10px] border border-[#d97742]/35 bg-[#d97742]/12 px-4 py-2.5 text-[12px] font-semibold text-[#e09560] transition hover:border-[#d97742]/55 hover:bg-[#d97742]/22"
            onClick={() => openUndoDialog(runId)}
          >
            <Undo2 size={14} />
            撤销本轮修改
          </button>
        ) : viewState.executing ? (
          <div className="flex items-center justify-center gap-2 rounded-[10px] border border-white/[0.06] bg-white/[0.02] px-4 py-2.5 text-[12px] text-white/38">
            <Loader2 size={14} className="animate-spin" />
            正在撤销
          </div>
        ) : response.status === "UNDONE" ? (
          <div className="flex items-center justify-center gap-2 rounded-[10px] border border-emerald-400/15 bg-emerald-400/[0.04] px-4 py-2.5 text-[12px] font-medium text-emerald-400/70">
            <Check size={14} />
            本轮修改已撤销
          </div>
        ) : response.status === "OPEN" ? (
          <div className="flex items-center justify-center gap-2 rounded-[10px] border border-white/[0.06] bg-white/[0.02] px-4 py-2.5 text-[12px] text-white/30">
            <Loader2 size={14} className="animate-spin" />
            正在生成撤销点
          </div>
        ) : response.status === "SUSPENDED" ? (
          <div className="flex items-center justify-center gap-2 rounded-[10px] border border-white/[0.06] bg-white/[0.02] px-4 py-2.5 text-[12px] text-amber-400/60">
            <Loader2 size={14} className="animate-spin" />
            等待审批或用户输入
          </div>
        ) : response.status === "NO_CHANGES" ? (
          <div className="rounded-[10px] border border-dashed border-white/[0.08] px-4 py-2.5 text-center text-[11.5px] text-white/30">
            本轮没有 Git 可见修改
          </div>
        ) : response.status === "EXPIRED" ? (
          <div className="rounded-[10px] border border-dashed border-white/[0.08] px-4 py-2.5 text-center text-[11.5px] text-white/30">
            撤销点已过期
          </div>
        ) : response.status === "FAILED" ? (
          <button
            type="button"
            className="flex w-full items-center justify-center gap-2 rounded-[10px] border border-white/[0.08] bg-white/[0.03] px-4 py-2.5 text-[12px] text-white/50 transition hover:border-primary/25 hover:text-primary"
            onClick={() => void loadUndo(runId)}
          >
            <RotateCcw size={14} />
            重试查询
          </button>
        ) : null}
      </div>
    </div>
  );
}

function taskStatusDot(status: string) {
  if (status === "STARTING" || status === "RUNNING") return "bg-amber-400 animate-pulse";
  if (status === "SUCCEEDED") return "bg-emerald-400";
  if (status === "FAILED" || status === "TIMED_OUT") return "bg-red-400";
  if (status === "CANCELLED") return "bg-white/25";
  return "bg-white/15";
}

function BackgroundTaskDetail({ task, runId }: { task: BackgroundTaskState; runId?: string }) {
  const fetchTaskDetail = useAgentStore((state) => state.fetchTaskDetail);
  const [tab, setTab] = useState<"stdout" | "stderr">("stdout");
  const isRunning = task.status === "STARTING" || task.status === "RUNNING";

  return (
    <div className="mt-2 rounded-[10px] border border-white/[0.08] bg-white/[0.015] overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-white/[0.06]">
        {isRunning ? <Loader2 size={12} className="animate-spin text-white/45" /> : null}
        <span className="font-mono text-[11px] text-white/55 truncate">{task.command}</span>
        {runId ? (
          <button
            type="button"
            className="ml-auto rounded p-1 text-white/30 hover:text-white/60 transition"
            title="刷新输出"
            onClick={() => void fetchTaskDetail(runId, task.taskId)}
          >
            <RefreshCw size={12} />
          </button>
        ) : null}
      </div>
      <div className="flex border-b border-white/[0.05]">
        <button
          type="button"
          className={cn(
            "flex-1 py-1.5 text-[10px] font-semibold uppercase tracking-[0.06em] transition",
            tab === "stdout" ? "bg-white/[0.04] text-white/55" : "text-white/25 hover:text-white/40"
          )}
          onClick={() => setTab("stdout")}
        >
          stdout
        </button>
        <button
          type="button"
          className={cn(
            "flex-1 py-1.5 text-[10px] font-semibold uppercase tracking-[0.06em] transition",
            tab === "stderr" ? "bg-white/[0.04] text-white/55" : "text-white/25 hover:text-white/40"
          )}
          onClick={() => setTab("stderr")}
        >
          stderr
        </button>
      </div>
      <pre className="max-h-[300px] overflow-auto p-3 font-mono text-[10px] leading-relaxed text-white/50 whitespace-pre-wrap break-all">
        {(tab === "stdout" ? task.stdoutChunks : task.stderrChunks).join("") || (
          <span className="text-white/20">暂无输出</span>
        )}
      </pre>
      {(tab === "stdout" ? task.stdoutEof : task.stderrEof) ? (
        <div className="px-3 pb-2 text-[10px] text-white/20">输出已结束</div>
      ) : isRunning ? (
        <div className="px-3 pb-2 text-[10px] text-white/25">点击刷新获取最新输出</div>
      ) : null}
    </div>
  );
}

function BackgroundTaskItem({
  task,
  runId,
  isExpanded,
  onToggle
}: {
  task: BackgroundTaskState;
  runId?: string;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const cancelTask = useAgentStore((state) => state.cancelBackgroundTask);
  const fetchTaskDetail = useAgentStore((state) => state.fetchTaskDetail);
  const isRunning = task.status === "STARTING" || task.status === "RUNNING";
  const isTerminal = !isRunning && task.status !== "STARTING";

  return (
    <div className="rounded-[10px] border border-white/[0.06] bg-white/[0.012] transition hover:border-white/[0.1]">
      <button
        type="button"
        className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left"
        onClick={onToggle}
      >
        <span className={cn("h-2 w-2 shrink-0 rounded-full", taskStatusDot(task.status))} />
        <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-white/65">{task.command}</span>
        {isRunning ? (
          <button
            type="button"
            className="rounded p-0.5 text-white/25 hover:text-red-400 transition"
            title="取消任务"
            onClick={(e) => {
              e.stopPropagation();
              if (runId) void cancelTask(runId, task.taskId);
            }}
          >
            <X size={13} />
          </button>
        ) : (
          <button
            type="button"
            className="rounded p-0.5 text-white/20 hover:text-white/50 transition"
            title="刷新"
            onClick={(e) => {
              e.stopPropagation();
              if (runId) void fetchTaskDetail(runId, task.taskId);
            }}
          >
            <RefreshCw size={11} />
          </button>
        )}
      </button>
      <div className="flex items-center gap-3 px-3 pb-2 text-[10px] text-white/30">
        <span>{backgroundTaskStatusLabel(task.status)}</span>
        <span>{formatBytes((task.stdoutBytes || 0) + (task.stderrBytes || 0))}</span>
        {task.exitCode !== undefined ? <span>exit {task.exitCode}</span> : null}
      </div>
      {isExpanded ? <BackgroundTaskDetail task={task} runId={runId} /> : null}
    </div>
  );
}

function BackgroundTasksPanel() {
  const backgroundTasks = useAgentStore((state) => state.backgroundTasks);
  const backgroundTasksLoading = useAgentStore((state) => state.backgroundTasksLoading);
  const selectedBackgroundTaskId = useAgentStore((state) => state.selectedBackgroundTaskId);
  const selectBackgroundTask = useAgentStore((state) => state.selectBackgroundTask);
  const fetchBackgroundTasks = useAgentStore((state) => state.fetchBackgroundTasks);
  const runId = useAgentStore((state) => state.runId);

  return (
    <div className="flex flex-1 flex-col min-h-0 space-y-2">
      <div className="flex items-center">
        <button
          type="button"
          className="ml-auto rounded p-1 text-white/30 hover:text-white/60 transition"
          title="刷新任务列表"
          disabled={backgroundTasksLoading}
          onClick={() => {
            if (runId) void fetchBackgroundTasks(runId);
          }}
        >
          <RefreshCw size={13} className={backgroundTasksLoading ? "animate-spin" : ""} />
        </button>
      </div>
      {backgroundTasks.length === 0 ? (
        <div className="flex min-h-[200px] flex-col items-center justify-center rounded-[14px] border border-dashed border-white/[0.1] bg-white/[0.015] px-4 text-center">
          <span className="mb-3 flex h-9 w-9 items-center justify-center rounded-full bg-white/[0.045] text-white/35">
            <Loader2 size={17} strokeWidth={1.7} />
          </span>
          <div className="text-[12px] font-medium text-white/55">暂无后台任务</div>
          <div className="mt-1.5 text-[10.5px] leading-4 text-white/28">使用 runInBackground 选项执行命令后在此查看</div>
        </div>
      ) : (
        <div className="min-h-0 flex-1 space-y-1.5 overflow-auto pr-0.5">
          {backgroundTasks.map((task) => (
            <BackgroundTaskItem
              key={task.taskId}
              task={task}
              runId={runId}
              isExpanded={selectedBackgroundTaskId === task.taskId}
              onToggle={() => selectBackgroundTask(task.taskId)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function RightRail({ open }: { open: boolean }) {
  const plan = useAgentStore((state) => state.plan);
  const planTriggered = useAgentStore((state) => state.planTriggered);
  const trace = useAgentStore((state) => state.trace);
  const runId = useAgentStore((state) => state.runId);
  const undoByRunId = useAgentStore((state) => state.undoByRunId);
  const backgroundTasks = useAgentStore((state) => state.backgroundTasks);
  const [tab, setTab] = useState<RightTab>("trace");
  const visiblePlan = useMemo(() => plan.filter((item) => item.status !== "skipped"), [plan]);
  const hasPlan = planTriggered && visiblePlan.length > 0;
  const completed = visiblePlan.filter((item) => item.status === "done").length;
  const traceGroups = useMemo(() => {
    const groups = new Map<number, TraceItem[]>();
    trace.slice(-100).forEach((item) => {
      const items = groups.get(item.iteration) || [];
      items.push(item);
      groups.set(item.iteration, items);
    });
    return Array.from(groups.entries()).sort(([a], [b]) => a - b);
  }, [trace]);

  const undoViewState = runId ? undoByRunId[runId] : undefined;

  return (
    <aside
      className={cn(
        "min-h-0 shrink-0 overflow-hidden bg-[#121214] transition-[width,opacity] duration-200 ease-out",
        open ? "w-[min(340px,44vw)] border-l border-white/[0.07] opacity-100" : "w-0 opacity-0"
      )}
      aria-hidden={!open}
    >
      {open ? <div className="flex h-full w-[340px] min-h-0 flex-col">
        <section className="border-b border-white/[0.07] p-4">
          <div className="mb-3 flex items-center">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.1em] text-white/48">执行计划</h2>
            <span className="ml-auto rounded-full bg-white/[0.055] px-2 py-0.5 font-mono text-[10px] tabular-nums text-white/38">
              {hasPlan ? `${completed}/${visiblePlan.length}` : "—"}
            </span>
          </div>

          {hasPlan ? (
            <div className="max-h-[250px] space-y-1 overflow-auto">
              {visiblePlan.map((item) => (
                <div
                  key={item.id}
                  className={cn(
                    "flex gap-2.5 rounded-[10px] px-2.5 py-2 text-[12px]",
                    item.status === "doing" && "bg-primary/[0.075]"
                  )}
                >
                  <PlanIcon status={item.status} />
                  <span
                    className={cn(
                      "min-w-0 leading-5",
                      item.status === "done" && "text-white/34 line-through",
                      item.status === "doing" && "font-medium text-primary",
                      item.status === "blocked" && "text-red-300/80",
                      item.status === "pending" && "text-white/54",
                      item.status === "skipped" && "text-white/28 line-through"
                    )}
                  >
                    {item.title}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex min-h-[136px] flex-col items-center justify-center rounded-[14px] border border-dashed border-white/[0.1] bg-white/[0.015] px-5 text-center">
              <span className="mb-3 flex h-9 w-9 items-center justify-center rounded-full bg-white/[0.045] text-white/35">
                <Clock3 size={17} strokeWidth={1.7} />
              </span>
              <div className="text-[12px] font-medium text-white/55">本次未触发计划</div>
              <div className="mt-1.5 text-[10.5px] leading-4 text-white/28">简单任务直接执行，仅多步任务才生成 Todo</div>
            </div>
          )}
        </section>

        <section className="min-h-0 flex-1 p-4 flex flex-col">
          <div className="mb-3 flex items-center gap-1">
            <button
              type="button"
              className={cn(
                "rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.1em] transition",
                tab === "trace" ? "bg-white/[0.08] text-white/60" : "text-white/30 hover:text-white/45"
              )}
              onClick={() => setTab("trace")}
            >
              Trace
            </button>
            <button
              type="button"
              className={cn(
                "rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.1em] transition",
                tab === "changes" ? "bg-white/[0.08] text-white/60" : "text-white/30 hover:text-white/45"
              )}
              onClick={() => setTab("changes")}
            >
              Changes
            </button>
            <button
              type="button"
              className={cn(
                "rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.1em] transition",
                tab === "tasks" ? "bg-white/[0.08] text-white/60" : "text-white/30 hover:text-white/45"
              )}
              onClick={() => setTab("tasks")}
            >
              Tasks
            </button>
            <span className="ml-auto rounded-full bg-white/[0.055] px-2 py-0.5 text-[10px] text-white/38">
              {tab === "trace" ? `${traceGroups.length} 轮循环` : tab === "changes" ? "undo" : `${backgroundTasks.length} 任务`}
            </span>
          </div>

          {tab === "trace" ? (
            <div className="min-h-0 flex-1 space-y-2 overflow-auto pr-0.5">
              {traceGroups.length ? (
                traceGroups.map(([iteration, items]) => <TraceGroup key={iteration} iteration={iteration} items={items} />)
              ) : (
                <div className="rounded-[12px] border border-dashed border-white/[0.09] px-3 py-5 text-center font-mono text-[11px] text-white/25">
                  暂无 trace
                </div>
              )}
            </div>
          ) : tab === "tasks" ? (
            <BackgroundTasksPanel />
          ) : (
            <ChangesPanel viewState={undoViewState} runId={runId} />
          )}
        </section>
      </div>
      : null}
    </aside>
  );
}
