import { GitBranch, Loader2, PanelLeft, PanelRight, RotateCcw, Wifi, WifiOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { shortId } from "@/lib/utils";
import { useAgentStore } from "@/store/agentStore";
import type { AgentUsageSummary } from "@/types/backend";
import { statusColor, statusLabel } from "./status";

function formatCacheHitRate(rate: number | null | undefined): string {
  if (rate === null || rate === undefined) return "--";
  return `${(rate * 100).toFixed(1)}%`;
}

function UsageBadge({ usage }: { usage?: AgentUsageSummary }) {
  if (!usage || usage.totalTokens === undefined) {
    return <Badge className="hidden md:inline-flex">tokens n/a</Badge>;
  }
  return (
    <>
      <Badge className="hidden md:inline-flex">本轮 tokens {usage.totalTokens.toLocaleString()}</Badge>
      <Badge className="hidden md:inline-flex">缓存 {formatCacheHitRate(usage.cacheHitRate)}</Badge>
    </>
  );
}

export function TopBar({
  leftPanelOpen,
  rightPanelOpen,
  onToggleLeftPanel,
  onToggleRightPanel
}: {
  leftPanelOpen: boolean;
  rightPanelOpen: boolean;
  onToggleLeftPanel: () => void;
  onToggleRightPanel: () => void;
}) {
  const status = useAgentStore((state) => state.status);
  const recoverable = useAgentStore((state) => state.recoverable);
  const resumeDisconnectedRun = useAgentStore((state) => state.resumeDisconnectedRun);
  const workspace = useAgentStore((state) => state.workspace);
  const requestId = useAgentStore((state) => state.requestId);
  const runId = useAgentStore((state) => state.runId);
  const usageByRunId = useAgentStore((state) => state.usageByRunId);
  const backgroundTasks = useAgentStore((state) => state.backgroundTasks);
  const usage = runId ? usageByRunId[runId] : undefined;

  const activeTaskCount = backgroundTasks.filter(
    (t) => t.status === "STARTING" || t.status === "RUNNING"
  ).length;

  const StatusIcon = status === "DISCONNECTED" ? WifiOff : Wifi;

  return (
    <header className="panel-edge flex h-[46px] shrink-0 items-center justify-between border-b px-4">
      <div className="flex min-w-0 items-center gap-3">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn("h-7 w-7 text-white/38", leftPanelOpen && "bg-primary/10 text-primary")}
          title="切换会话与文件栏（⌘/Ctrl+1）"
          aria-label="切换会话与文件栏"
          aria-pressed={leftPanelOpen}
          onClick={onToggleLeftPanel}
        >
          <PanelLeft size={15} />
        </Button>
        <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-primary/30 bg-primary/10 text-primary">
          <GitBranch size={15} />
        </div>
        <div className="min-w-0">
          <div className="truncate font-mono text-sm font-semibold">Loom Agent</div>
          <div className="truncate font-mono text-[11px] text-muted-foreground">{workspace || "default workspace"}</div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <UsageBadge usage={usage} />
        {activeTaskCount > 0 ? (
          <Badge className="hidden md:inline-flex gap-1 border-amber-400/30 bg-amber-400/10 text-amber-300">
            <Loader2 size={11} className="animate-spin" />
            bg {activeTaskCount}
          </Badge>
        ) : null}
        <Badge className="hidden lg:inline-flex">request {shortId(requestId)}</Badge>
        <Badge className="gap-1.5" title={statusLabel(status)}>
          <span className={`h-1.5 w-1.5 rounded-full ${statusColor(status)}`} />
          <StatusIcon size={12} />
          {statusLabel(status)}
          {recoverable ? (
            <button
              type="button"
              className="ml-1 inline-flex items-center gap-0.5 rounded border border-amber-400/40 bg-amber-400/15 px-1 py-0.5 text-[9.5px] font-medium text-amber-300 transition hover:border-amber-400/60 hover:bg-amber-400/25"
              title="尝试恢复"
              aria-label="恢复运行"
              onClick={() => void resumeDisconnectedRun()}
            >
              <RotateCcw size={9} />
              恢复
            </button>
          ) : null}
        </Badge>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn("h-7 w-7 text-white/38", rightPanelOpen && "bg-primary/10 text-primary")}
          title="切换计划与 Trace 栏（⌘/Ctrl+2）"
          aria-label="切换计划与 Trace 栏"
          aria-pressed={rightPanelOpen}
          onClick={onToggleRightPanel}
        >
          <PanelRight size={15} />
        </Button>
      </div>
    </header>
  );
}
