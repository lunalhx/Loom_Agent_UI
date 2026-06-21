import { useMemo, useState } from "react";
import ReactDiffViewer from "react-diff-viewer-continued";
import { Check, TimerReset, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { tryStringify } from "@/lib/utils";
import { useAgentStore, type ApprovalState } from "@/store/agentStore";

function secondsUntil(value?: string) {
  if (!value) return undefined;
  const seconds = Math.floor((new Date(value).getTime() - Date.now()) / 1000);
  return Number.isFinite(seconds) ? Math.max(seconds, 0) : undefined;
}

export function DiffApprovalCard({ approval }: { approval: ApprovalState }) {
  const [reason, setReason] = useState("");
  const decide = useAgentStore((state) => state.decide);
  const event = approval.event;
  const seconds = secondsUntil(event.expiresAt);
  const diff = event.diff;
  const disabled = approval.status === "approving" || approval.status === "rejecting";

  const diffView = useMemo(() => {
    if (!diff) return null;
    if (diff.format === "OLD_NEW") {
      return (
        <ReactDiffViewer
          oldValue={diff.oldText || ""}
          newValue={diff.newText || ""}
          splitView
          useDarkTheme
        />
      );
    }
    return (
      <pre className="max-h-80 overflow-auto rounded border border-border bg-[#090b0d] p-3 font-mono text-xs text-muted-foreground">
        {diff.unifiedDiff}
      </pre>
    );
  }, [diff]);

  return (
    <div className="rounded border border-primary/35 bg-[#11100c] p-3 shadow-insetline">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-mono text-sm text-primary">{event.tool}</div>
          <div className="mt-1 text-sm text-muted-foreground">{event.riskReason}</div>
        </div>
        <div className="flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground">
          <TimerReset size={13} />
          {seconds === undefined ? "n/a" : `${seconds}s`}
        </div>
      </div>

      <div className="mb-3 rounded border border-border bg-[#0b0d0f] p-2 font-mono text-xs text-muted-foreground">
        <div className="text-foreground">{event.operationPreview}</div>
        <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap">{tryStringify(event.input)}</pre>
      </div>

      {diffView ?? (
        <div className="mb-3 rounded border border-dashed border-border bg-[#0b0d0f] p-3 font-mono text-xs text-muted-foreground">
          后端未提供 diff 内容
        </div>
      )}

      <Textarea
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        rows={2}
        placeholder="reason"
        className="mb-3 min-h-14 font-mono text-xs"
      />

      <div className="flex items-center justify-end gap-2">
        <Button variant="outline" size="sm" disabled={disabled} onClick={() => void decide(approval.approvalId, "REJECT", reason)}>
          <X size={14} />
          Reject
        </Button>
        <Button size="sm" disabled={disabled} onClick={() => void decide(approval.approvalId, "APPROVE", reason)}>
          <Check size={14} />
          Approve
        </Button>
      </div>
    </div>
  );
}
