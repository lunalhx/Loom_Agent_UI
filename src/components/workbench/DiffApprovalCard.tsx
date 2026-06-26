import { Check, FilePenLine, Loader2, TimerReset, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { basename, isWriteTool } from "@/lib/utils";
import { useAgentStore, type ApprovalState } from "@/store/agentStore";
import { CodeDiffPanel } from "./CodeDiffPanel";

function secondsUntil(value?: string) {
  if (!value) return undefined;
  const seconds = Math.floor((new Date(value).getTime() - Date.now()) / 1000);
  return Number.isFinite(seconds) ? Math.max(seconds, 0) : undefined;
}

function stringInputValue(input: Record<string, unknown> | undefined, key: string) {
  const value = input?.[key];
  return typeof value === "string" ? value : undefined;
}

export function DiffApprovalCard({ approval }: { approval: ApprovalState }) {
  const decide = useAgentStore((state) => state.decide);
  const event = approval.event;
  const seconds = secondsUntil(event.expiresAt);
  const diff = event.diff;
  const disabled = approval.status === "approving" || approval.status === "rejecting";
  const writeApproval = isWriteTool(event.tool);
  const filePath = diff?.path || stringInputValue(event.input, "path");
  const targetLabel = writeApproval ? basename(filePath) : event.tool;
  const resultTarget = writeApproval ? basename(filePath) : event.tool || "操作";
  const decisionText = writeApproval ? `即将写入 ${filePath || "目标文件"}, 是否批准?` : event.operationPreview || event.riskReason;
  const isResolved = approval.status === "approved" || approval.status === "rejected" || approval.status === "expired";
  const resultText =
    approval.status === "approved"
      ? writeApproval
        ? `已批准 · 已写入 ${resultTarget}`
        : `已批准 · ${resultTarget}`
      : approval.status === "rejected"
        ? writeApproval
          ? `已拒绝 · 未写入 ${resultTarget}`
          : `已拒绝 · ${resultTarget}`
        : approval.status === "expired"
          ? `已过期 · 未处理 ${resultTarget}`
          : undefined;

  return (
    <div className="space-y-3 rounded-[12px] border border-primary/25 bg-[#191a1c] p-3 shadow-insetline">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2 font-mono text-[13px] text-white/80">
            <FilePenLine size={15} />
            <span className="truncate">{targetLabel}</span>
            <span className="rounded bg-sky-400/15 px-2 py-0.5 text-[10px] font-semibold text-sky-200">{event.tool}</span>
          </div>
          <div className="mt-1 line-clamp-2 text-[12.5px] text-white/45">{event.operationPreview || event.riskReason}</div>
        </div>
        <div className="flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground">
          <TimerReset size={13} />
          {seconds === undefined ? "n/a" : `${seconds}s`}
        </div>
      </div>

      {writeApproval ? <CodeDiffPanel diff={diff} path={filePath} /> : null}

      {isResolved ? (
        <div
          role="status"
          className={
            approval.status === "approved"
              ? "flex min-h-12 items-center gap-3 rounded-[10px] border border-emerald-500/40 bg-emerald-950/35 px-3 py-2.5 text-emerald-300"
              : "flex min-h-12 items-center gap-3 rounded-[10px] border border-red-500/40 bg-red-950/30 px-3 py-2.5 text-red-300"
          }
        >
          {approval.status === "approved" ? <Check className="shrink-0" size={18} /> : <X className="shrink-0" size={18} />}
          <span className="min-w-0 flex-1 truncate text-[13px] font-semibold">{resultText}</span>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-3 rounded-[10px] border border-primary/35 bg-primary/10 px-3 py-2.5">
          <span className="rounded bg-primary/20 px-2.5 py-1 text-xs font-semibold text-primary">{disabled ? "处理中" : "高危"}</span>
          <span className="min-w-[180px] flex-1 text-[13px] font-semibold text-white/72">
            {approval.status === "approving" ? "正在批准，请稍候..." : approval.status === "rejecting" ? "正在拒绝，请稍候..." : decisionText}
          </span>
          <div className="flex shrink-0 items-center gap-2">
            <Button variant="outline" size="sm" disabled={disabled} onClick={() => void decide(approval.approvalId, "REJECT")}>
              {approval.status === "rejecting" ? <Loader2 className="animate-spin" size={14} /> : <X size={14} />}
              拒绝
            </Button>
            <Button size="sm" disabled={disabled} onClick={() => void decide(approval.approvalId, "APPROVE")}>
              {approval.status === "approving" ? <Loader2 className="animate-spin" size={14} /> : <Check size={14} />}
              批准
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
