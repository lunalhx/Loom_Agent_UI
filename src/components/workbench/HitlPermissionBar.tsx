import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAgentStore } from "@/store/agentStore";

export function HitlPermissionBar() {
  const approvals = useAgentStore((state) => state.approvals);
  const decide = useAgentStore((state) => state.decide);
  const pending = Object.values(approvals).find((approval) => approval.status === "pending");

  if (!pending) return null;

  return (
    <div className="sticky top-0 z-20 border-b border-primary/30 bg-[#181208] px-4 py-2 shadow-insetline">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <ShieldAlert className="shrink-0 text-primary" size={16} />
          <div className="min-w-0">
            <div className="truncate font-mono text-xs text-primary">{pending.event.tool} · {pending.event.permissionLevel}</div>
            <div className="truncate text-xs text-muted-foreground">{pending.event.operationPreview || pending.event.riskReason}</div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => void decide(pending.approvalId, "REJECT")}>
            Reject
          </Button>
          <Button size="sm" onClick={() => void decide(pending.approvalId, "APPROVE")}>
            Approve
          </Button>
        </div>
      </div>
    </div>
  );
}
