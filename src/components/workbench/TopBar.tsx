import { GitBranch, PanelLeft, PanelRight, Wifi } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { shortId } from "@/lib/utils";
import { useAgentStore } from "@/store/agentStore";
import { statusColor, statusLabel } from "./status";

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
  const workspace = useAgentStore((state) => state.workspace);
  const requestId = useAgentStore((state) => state.requestId);
  const usage = useAgentStore((state) => state.usage);

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
        <Badge className="hidden md:inline-flex">tokens {usage?.totalTokens ?? "n/a"}</Badge>
        <Badge className="hidden lg:inline-flex">request {shortId(requestId)}</Badge>
        <Badge className="gap-1.5">
          <span className={`h-1.5 w-1.5 rounded-full ${statusColor(status)}`} />
          <Wifi size={12} />
          {statusLabel(status)}
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
