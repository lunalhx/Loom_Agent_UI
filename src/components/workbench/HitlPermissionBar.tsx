import { ShieldAlert, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAgentStore } from "@/store/agentStore";
import type { SkillApprovalItem } from "@/types/backend";

export function HitlPermissionBar() {
  const approvals = useAgentStore((state) => state.approvals);
  const decide = useAgentStore((state) => state.decide);
  const selectedSkillNames = useAgentStore((state) => state.selectedSkillNames);
  const availableSkills = useAgentStore((state) => state.availableSkills);
  const pending = Object.values(approvals).find((approval) => approval.status === "pending");

  if (!pending) return null;

  const isSkillActivation = pending.event.metadata?.kind === "skill_activation";
  const skillItems: SkillApprovalItem[] = isSkillActivation
    ? (pending.event.metadata?.skills as SkillApprovalItem[] | undefined) ?? []
    : [];

  const handleReject = () => {
    // Remove project skills from selection so they don't re-trigger
    if (isSkillActivation && skillItems.length > 0) {
      const rejectedNames = new Set(skillItems.map((s) => s.name));
      const store = useAgentStore.getState();
      const updated = store.selectedSkillNames.filter((n) => !rejectedNames.has(n));
      useAgentStore.setState({ selectedSkillNames: updated });
    }
    void decide(pending.approvalId, "REJECT");
  };

  return (
    <div className="sticky top-0 z-20 border-b border-primary/30 bg-[#181208] px-4 py-2 shadow-insetline">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <ShieldAlert className="shrink-0 text-primary" size={16} />
          <div className="min-w-0">
            {isSkillActivation ? (
              <>
                <div className="text-xs text-primary font-medium">
                  启用 {skillItems.length} 个项目级技能
                </div>
                <div className="flex flex-wrap gap-1 mt-1">
                  {skillItems.map((s) => (
                    <span
                      key={s.name}
                      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-500/15 text-[11px] text-amber-300"
                    >
                      <CheckCircle2 className="h-3 w-3" />
                      {s.name}
                      {s.description && (
                        <span className="text-amber-400/60 hidden sm:inline">— {s.description}</span>
                      )}
                    </span>
                  ))}
                </div>
              </>
            ) : (
              <>
                <div className="truncate font-mono text-xs text-primary">{pending.event.tool} · {pending.event.permissionLevel}</div>
                <div className="truncate text-xs text-muted-foreground">{pending.event.operationPreview || pending.event.riskReason}</div>
              </>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleReject}>
            {isSkillActivation ? "跳过这些技能并继续" : "Reject"}
          </Button>
          <Button size="sm" onClick={() => void decide(pending.approvalId, "APPROVE")}>
            {isSkillActivation ? "允许并继续" : "Approve"}
          </Button>
        </div>
      </div>
    </div>
  );
}
