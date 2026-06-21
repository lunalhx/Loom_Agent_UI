import { ChevronDown, Cpu, GitBranch, Wifi } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { shortId } from "@/lib/utils";
import { useAgentStore } from "@/store/agentStore";
import { statusColor, statusLabel } from "./status";

export function TopBar() {
  const status = useAgentStore((state) => state.status);
  const workspace = useAgentStore((state) => state.workspace);
  const allowedModels = useAgentStore((state) => state.allowedModels);
  const selectedModel = useAgentStore((state) => state.selectedModel);
  const setSelectedModel = useAgentStore((state) => state.setSelectedModel);
  const requestId = useAgentStore((state) => state.requestId);
  const usage = useAgentStore((state) => state.usage);

  return (
    <header className="panel-edge flex h-[46px] shrink-0 items-center justify-between border-b px-4">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-primary/30 bg-primary/10 text-primary">
          <GitBranch size={15} />
        </div>
        <div className="min-w-0">
          <div className="truncate font-mono text-sm font-semibold">Loom Agent</div>
          <div className="truncate font-mono text-[11px] text-muted-foreground">{workspace || "default workspace"}</div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="relative hidden sm:block">
          <Cpu className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-muted-foreground" size={15} />
          <Select
            value={selectedModel}
            onChange={(event) => setSelectedModel(event.target.value)}
            aria-label="model"
            className="h-8 min-w-[218px] pr-9"
          >
            {allowedModels.map((model) => (
              <option key={model} value={model}>
                {model}
              </option>
            ))}
          </Select>
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={14} />
        </div>
        <Badge className="hidden md:inline-flex">tokens {usage?.totalTokens ?? "n/a"}</Badge>
        <Badge className="hidden lg:inline-flex">request {shortId(requestId)}</Badge>
        <Badge className="gap-1.5">
          <span className={`h-1.5 w-1.5 rounded-full ${statusColor(status)}`} />
          <Wifi size={12} />
          {statusLabel(status)}
        </Badge>
      </div>
    </header>
  );
}
