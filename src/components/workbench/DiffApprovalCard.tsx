import * as AlertDialog from "@radix-ui/react-alert-dialog";
import { useState } from "react";
import { AlertTriangle, Check, ChevronDown, FilePenLine, Loader2, TimerReset, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { basename, formatBytes, isWriteTool } from "@/lib/utils";
import { useAgentStore, type ApprovalState } from "@/store/agentStore";
import type { DeleteApprovalPreview } from "@/types/backend";
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

function DeletePreview({ preview }: { preview: DeleteApprovalPreview }) {
  const [expanded, setExpanded] = useState(false);
  const visiblePaths = expanded ? preview.samplePaths : preview.samplePaths.slice(0, 6);
  const hiddenCount = Math.max(0, preview.samplePaths.length - visiblePaths.length);
  const undoWarning = preview.riskFlags.includes("UNDO_MAY_BE_UNAVAILABLE");

  return (
    <div className="space-y-2.5 rounded-[11px] border border-red-500/20 bg-red-950/15 p-3">
      <div className="flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px] text-white/55">
        <span>{preview.fileCount} 文件</span>
        <span>{preview.directoryCount} 目录</span>
        <span>{preview.symlinkCount} 链接</span>
        <span>{formatBytes(preview.totalBytes)}</span>
      </div>

      <div className="space-y-1">
        {preview.targets.map((target) => (
          <div key={`${target.kind}:${target.path}`} className="flex min-w-0 items-center gap-2">
            <span className="shrink-0 rounded bg-red-400/10 px-1.5 py-0.5 font-mono text-[9px] text-red-300/80">
              {target.kind === "DIRECTORY" ? "目录" : target.kind === "SYMLINK" ? "链接" : "文件"}
            </span>
            <span className="truncate font-mono text-[11px] text-white/65" title={target.path}>{target.path}</span>
          </div>
        ))}
      </div>

      {preview.samplePaths.length > 0 ? (
        <div className="rounded-[8px] border border-white/[0.06] bg-black/15 px-2.5 py-2">
          <div className="space-y-0.5">
            {visiblePaths.map((path) => (
              <div key={path} className="truncate font-mono text-[10px] leading-5 text-white/35" title={path}>{path}</div>
            ))}
          </div>
          {preview.samplePaths.length > 6 ? (
            <button
              type="button"
              className="mt-1 flex items-center gap-1 text-[10px] text-white/40 hover:text-white/65"
              onClick={() => setExpanded((value) => !value)}
            >
              <ChevronDown size={11} className={expanded ? "rotate-180" : ""} />
              {expanded ? "收起清单" : `展开更多${hiddenCount > 0 ? `（另有 ${hiddenCount} 项）` : ""}`}
            </button>
          ) : null}
          {preview.truncated ? <div className="mt-1 text-[10px] text-white/25">仅展示前 50 项</div> : null}
        </div>
      ) : null}

      <div className="space-y-0.5 text-[10.5px] leading-5 text-red-200/55">
        {preview.symlinkCount > 0 ? <p>符号链接只删除链接本身，不会访问链接目标。</p> : null}
        {undoWarning ? <p>可能包含 Git ignored 内容或超过快照限制，一键撤销不保证完整恢复。</p> : null}
      </div>
    </div>
  );
}

export function DiffApprovalCard({ approval }: { approval: ApprovalState }) {
  const decide = useAgentStore((state) => state.decide);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const event = approval.event;
  const seconds = secondsUntil(event.expiresAt);
  const diff = event.diff;
  const disabled = approval.status === "approving" || approval.status === "rejecting";
  const writeApproval = isWriteTool(event.tool);
  const deleteApproval = event.tool === "delete_files";
  const deletePreview = event.metadata?.deletePreview;
  const filePath = diff?.path || stringInputValue(event.input, "path");
  const deleteTargetLabel = deletePreview?.targetCount
    ? deletePreview.targetCount === 1
      ? deletePreview.targets[0]?.path || "删除目标"
      : `${deletePreview.targetCount} 个删除目标`
    : "delete_files";
  const targetLabel = writeApproval ? basename(filePath) : deleteApproval ? deleteTargetLabel : event.tool;
  const resultTarget = writeApproval ? basename(filePath) : event.tool || "操作";
  const decisionText = writeApproval
    ? `即将写入 ${filePath || "目标文件"}, 是否批准?`
    : deleteApproval
      ? "确认删除以上目标？"
      : event.operationPreview || event.riskReason;
  const isResolved = approval.status === "approved"
    || approval.status === "executed"
    || approval.status === "execution_failed"
    || approval.status === "rejected"
    || approval.status === "expired";
  const resultText =
    approval.status === "executed"
      ? "删除完成"
      : approval.status === "execution_failed"
        ? "删除执行失败，请查看运行结果"
        : approval.status === "approved"
      ? writeApproval
        ? `已批准 · 已写入 ${resultTarget}`
        : deleteApproval
          ? "已批准 · 等待执行删除"
          : `已批准 · ${resultTarget}`
      : approval.status === "rejected"
        ? writeApproval
          ? `已拒绝 · 未写入 ${resultTarget}`
          : deleteApproval
            ? "已拒绝 · 未删除"
            : `已拒绝 · ${resultTarget}`
        : approval.status === "expired"
          ? `已过期 · 未处理 ${resultTarget}`
          : undefined;

  const approve = () => {
    if (deleteApproval && deletePreview?.requiresSecondConfirmation) {
      setConfirmOpen(true);
      return;
    }
    void decide(approval.approvalId, "APPROVE");
  };

  const confirmDelete = () => {
    setConfirmOpen(false);
    void decide(approval.approvalId, "APPROVE");
  };

  return (
    <>
      <div className={`space-y-3 rounded-[12px] border p-3 shadow-insetline ${deleteApproval ? "border-red-500/25 bg-[#1b1718]" : "border-primary/25 bg-[#191a1c]"}`}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-2 font-mono text-[13px] text-white/80">
              {deleteApproval ? <Trash2 size={15} className="text-red-300" /> : <FilePenLine size={15} />}
              <span className="truncate">{targetLabel}</span>
              <span className={`rounded px-2 py-0.5 text-[10px] font-semibold ${deleteApproval ? "bg-red-400/15 text-red-200" : "bg-sky-400/15 text-sky-200"}`}>
                {event.tool}
              </span>
            </div>
            <div className={`mt-1 text-[12.5px] text-white/45 ${deleteApproval ? "whitespace-pre-line" : "line-clamp-2"}`}>
              {event.operationPreview || event.riskReason}
            </div>
          </div>
          <div className="flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground">
            <TimerReset size={13} />
            {seconds === undefined ? "n/a" : `${seconds}s`}
          </div>
        </div>

        {writeApproval ? <CodeDiffPanel diff={diff} path={filePath} /> : null}
        {deleteApproval && deletePreview ? <DeletePreview preview={deletePreview} /> : null}

        {isResolved ? (
          <div
            role="status"
            className={
              approval.status === "approved" || approval.status === "executed"
                ? "flex min-h-12 items-center gap-3 rounded-[10px] border border-emerald-500/40 bg-emerald-950/35 px-3 py-2.5 text-emerald-300"
                : "flex min-h-12 items-center gap-3 rounded-[10px] border border-red-500/40 bg-red-950/30 px-3 py-2.5 text-red-300"
            }
          >
            {approval.status === "approved" || approval.status === "executed"
              ? <Check className="shrink-0" size={18} />
              : <X className="shrink-0" size={18} />}
            <span className="min-w-0 flex-1 truncate text-[13px] font-semibold">{resultText}</span>
          </div>
        ) : (
          <div className={`flex flex-wrap items-center gap-3 rounded-[10px] border px-3 py-2.5 ${deleteApproval ? "border-red-500/30 bg-red-500/10" : "border-primary/35 bg-primary/10"}`}>
            <span className={`rounded px-2.5 py-1 text-xs font-semibold ${deleteApproval ? "bg-red-400/15 text-red-200" : "bg-primary/20 text-primary"}`}>
              {disabled ? "处理中" : "高危"}
            </span>
            <span className="min-w-[180px] flex-1 text-[13px] font-semibold text-white/72">
              {approval.status === "approving" ? "正在批准，请稍候..." : approval.status === "rejecting" ? "正在拒绝，请稍候..." : decisionText}
            </span>
            <div className="flex shrink-0 items-center gap-2">
              <Button variant="outline" size="sm" disabled={disabled} onClick={() => void decide(approval.approvalId, "REJECT")}>
                {approval.status === "rejecting" ? <Loader2 className="animate-spin" size={14} /> : <X size={14} />}
                拒绝
              </Button>
              <Button
                size="sm"
                disabled={disabled}
                onClick={approve}
                className={deleteApproval ? "bg-red-500/80 text-white hover:bg-red-500" : undefined}
              >
                {approval.status === "approving" ? <Loader2 className="animate-spin" size={14} /> : deleteApproval ? <Trash2 size={14} /> : <Check size={14} />}
                {deleteApproval ? "批准删除" : "批准"}
              </Button>
            </div>
          </div>
        )}
      </div>

      <AlertDialog.Root open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialog.Portal>
          <AlertDialog.Overlay className="fixed inset-0 z-50 bg-black/65" />
          <AlertDialog.Content className="fixed left-1/2 top-1/2 z-50 w-[min(92vw,420px)] -translate-x-1/2 -translate-y-1/2 rounded-[18px] border border-red-500/25 bg-[#171416] p-6 shadow-[0_20px_60px_rgba(0,0,0,.55)]">
            <AlertDialog.Title className="flex items-center gap-2 text-[16px] font-semibold text-white/90">
              <AlertTriangle size={18} className="text-red-300" />
              最后确认删除
            </AlertDialog.Title>
            <AlertDialog.Description className="mt-3 text-[13px] leading-6 text-white/55">
              即将删除 {deletePreview?.fileCount || 0} 个文件、{deletePreview?.directoryCount || 0} 个目录。
              Git ignored 内容可能无法通过一键撤销恢复。
            </AlertDialog.Description>
            <div className="mt-5 flex justify-end gap-3">
              <AlertDialog.Cancel asChild>
                <Button type="button" variant="outline">返回检查</Button>
              </AlertDialog.Cancel>
              <AlertDialog.Action asChild>
                <Button type="button" onClick={confirmDelete} className="bg-red-500/80 text-white hover:bg-red-500">
                  <Trash2 size={14} />
                  确认删除
                </Button>
              </AlertDialog.Action>
            </div>
          </AlertDialog.Content>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </>
  );
}
