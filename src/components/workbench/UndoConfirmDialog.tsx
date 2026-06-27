import * as AlertDialog from "@radix-ui/react-alert-dialog";
import { Loader2, Undo2 } from "lucide-react";
import { useAgentStore } from "@/store/agentStore";
import type { UndoChangedFile } from "@/types/backend";

const changeTypeLabel: Record<string, string> = {
  ADDED: "新增",
  MODIFIED: "修改",
  DELETED: "删除",
  RENAMED: "重命名",
  TYPE_CHANGED: "类型变化"
};

const changeTypeColor: Record<string, string> = {
  ADDED: "text-emerald-400",
  MODIFIED: "text-primary",
  DELETED: "text-red-400",
  RENAMED: "text-sky-400",
  TYPE_CHANGED: "text-white/45"
};

function fileLabel(file: UndoChangedFile) {
  const tag = file.changeType;
  const label = changeTypeLabel[tag] || tag;
  if (file.changeType === "RENAMED" && file.oldPath) {
    return { tag, label, display: `${file.oldPath} → ${file.path}` };
  }
  return { tag, label, display: file.path };
}

export function UndoConfirmDialog() {
  const undoDialogRunId = useAgentStore((state) => state.undoDialogRunId);
  const undoByRunId = useAgentStore((state) => state.undoByRunId);
  const closeUndoDialog = useAgentStore((state) => state.closeUndoDialog);
  const confirmUndo = useAgentStore((state) => state.confirmUndo);

  const viewState = undoDialogRunId ? undoByRunId[undoDialogRunId] : undefined;
  const response = viewState?.response;
  const executing = viewState?.executing || false;
  const open = Boolean(undoDialogRunId && response);

  const files = response?.changedFiles || [];
  const totalCount = response?.changedFileCount || files.length;
  const previewFiles = files.slice(0, 8);
  const overflowCount = Math.max(0, totalCount - previewFiles.length);

  const handleConfirm = () => {
    if (undoDialogRunId && !executing) {
      void confirmUndo(undoDialogRunId);
    }
  };

  return (
    <AlertDialog.Root open={open} onOpenChange={(next) => { if (!next && !executing) closeUndoDialog(); }}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 z-50 bg-black/65 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <AlertDialog.Content
          className="fixed left-[50%] top-[50%] z-50 w-[min(92vw,420px)] translate-x-[-50%] translate-y-[-50%] rounded-[18px] border border-white/[0.1] bg-[#151518] p-6 shadow-[0_20px_60px_rgba(0,0,0,.5)] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 max-sm:undo-dialog-sheet"
          aria-describedby="undo-dialog-desc"
        >
          <AlertDialog.Title className="mb-2 flex items-center gap-2.5 text-[16px] font-semibold text-white/90">
            <Undo2 size={18} className="text-[#d97742]" />
            撤销本轮修改？
          </AlertDialog.Title>

          <AlertDialog.Description id="undo-dialog-desc" asChild>
            <div className="space-y-3 text-[13px] leading-6 text-white/55">
            <p>文件将恢复到本轮任务开始前的状态。</p>

            {totalCount > 0 ? (
              <div className="rounded-[12px] border border-white/[0.08] bg-white/[0.025] p-3 undo-file-list">
                <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-white/40">
                  共 {totalCount} 个文件
                  {response?.changedBytes !== undefined ? (
                    <span className="ml-2 font-normal normal-case tracking-normal">
                      · {response.changedBytes > 1024 ? `${(response.changedBytes / 1024).toFixed(1)} KB` : `${response.changedBytes} B`}
                    </span>
                  ) : null}
                </div>
                <ul className="space-y-1">
                  {previewFiles.map((file, index) => {
                    const { tag, display } = fileLabel(file);
                    return (
                      <li key={`${file.path}-${index}`} className="flex min-w-0 items-center gap-2">
                        <span className={`shrink-0 rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold ${changeTypeColor[tag] || "text-white/40"} bg-white/[0.05]`}>
                          {tag[0]}
                        </span>
                        <span className="truncate font-mono text-[11px] text-white/65" title={display}>
                          {display}
                        </span>
                      </li>
                    );
                  })}
                </ul>
                {overflowCount > 0 ? (
                  <div className="mt-2 text-[11px] text-white/30">另有 {overflowCount} 个文件</div>
                ) : null}
              </div>
            ) : null}

            <div className="rounded-[10px] border border-white/[0.06] bg-white/[0.015] px-3 py-2.5 text-[11.5px] leading-5 text-white/38">
              <p>· 不会撤销 commit、push 或 Git ignored 构建产物</p>
              <p className="mt-0.5">· 如果相同文件在任务结束后被再次修改，后端会拒绝覆盖</p>
            </div>
            </div>
          </AlertDialog.Description>

          <div className="mt-5 flex justify-end gap-3">
            <AlertDialog.Cancel asChild>
              <button
                type="button"
                disabled={executing}
                className="focus-ring inline-flex h-9 items-center gap-2 rounded-[10px] border border-white/[0.12] bg-white/[0.04] px-4 text-[13px] font-medium text-white/65 transition hover:bg-white/[0.08] hover:text-white/85 disabled:opacity-40"
              >
                保留修改
              </button>
            </AlertDialog.Cancel>
            <AlertDialog.Action asChild>
              <button
                type="button"
                disabled={executing}
                onClick={handleConfirm}
                className="focus-ring inline-flex h-9 items-center gap-2 rounded-[10px] border border-[#d45b4a]/40 bg-[#d45b4a]/18 px-4 text-[13px] font-medium text-[#e08878] transition hover:border-[#d45b4a]/60 hover:bg-[#d45b4a]/28 disabled:opacity-40"
              >
                {executing ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    正在撤销
                  </>
                ) : (
                  <>
                    <Undo2 size={14} />
                    确认撤销
                  </>
                )}
              </button>
            </AlertDialog.Action>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
