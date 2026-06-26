import { useMemo, useState } from "react";
import { Columns2, Rows3 } from "lucide-react";
import { basename, cn, diffLineStats } from "@/lib/utils";
import type { DiffHunk, DiffPayload, InlineDiffPart, StructuredDiffLine } from "@/types/backend";

type ViewMode = "unified" | "split";

type SideRow = {
  kind: "line" | "folded";
  oldLine?: StructuredDiffLine;
  newLine?: StructuredDiffLine;
  foldedCount?: number;
};

function pathFromUnifiedDiff(unifiedDiff?: string) {
  if (!unifiedDiff) return undefined;
  const newFile = unifiedDiff.match(/^\+\+\+\s+b\/(.+)$/m)?.[1];
  const oldFile = unifiedDiff.match(/^---\s+a\/(.+)$/m)?.[1];
  return newFile || oldFile;
}

function splitLines(text?: string) {
  const normalized = (text ?? "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  if (!normalized) return [];
  const lines = normalized.split("\n");
  if (normalized.endsWith("\n")) lines.pop();
  return lines;
}

function makeLine(type: StructuredDiffLine["type"], text: string, oldLineNumber?: number, newLineNumber?: number): StructuredDiffLine {
  return { type, text, oldLineNumber, newLineNumber };
}

function buildDiffLines(oldText?: string, newText?: string, contextRadius = 3): { hunks: DiffHunk[]; stats: { added: number; removed: number; modified: number } } {
  const oldLines = splitLines(oldText);
  const newLines = splitLines(newText);
  const lcs = Array.from({ length: oldLines.length + 1 }, () => Array(newLines.length + 1).fill(0));
  for (let i = oldLines.length - 1; i >= 0; i -= 1) {
    for (let j = newLines.length - 1; j >= 0; j -= 1) {
      lcs[i][j] = oldLines[i] === newLines[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }

  const lines: StructuredDiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < oldLines.length && j < newLines.length) {
    if (oldLines[i] === newLines[j]) {
      lines.push(makeLine("context", oldLines[i], i + 1, j + 1));
      i += 1;
      j += 1;
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      lines.push(makeLine("removed", oldLines[i], i + 1));
      i += 1;
    } else {
      lines.push(makeLine("added", newLines[j], undefined, j + 1));
      j += 1;
    }
  }
  while (i < oldLines.length) lines.push(makeLine("removed", oldLines[i], i + 1)), (i += 1);
  while (j < newLines.length) lines.push(makeLine("added", newLines[j], undefined, j + 1)), (j += 1);

  const stats = attachInlineDiff(lines);
  const clipped = Number.isFinite(contextRadius) ? clipContext(lines, contextRadius) : lines;
  return { hunks: [{ lines: clipped }], stats };
}

function attachInlineDiff(lines: StructuredDiffLine[]) {
  const added = lines.filter((line) => line.type === "added").length;
  const removed = lines.filter((line) => line.type === "removed").length;
  let modified = 0;
  let pairId = 1;
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    if (line.type === "context") {
      index += 1;
      continue;
    }

    const start = index;
    while (index < lines.length && lines[index].type !== "context") index += 1;
    const removedBlock = lines.slice(start, index).filter((candidate) => candidate.type === "removed");
    const addedBlock = lines.slice(start, index).filter((candidate) => candidate.type === "added");
    for (let offset = 0; offset < Math.min(removedBlock.length, addedBlock.length); offset += 1) {
      const removedLine = removedBlock[offset];
      const addedLine = addedBlock[offset];
      if (similarity(removedLine.text ?? "", addedLine.text ?? "") >= 0.5) {
        const inlineDiff = buildInlineDiff(removedLine.text ?? "", addedLine.text ?? "");
        removedLine.pairId = pairId;
        removedLine.inlineDiff = inlineDiff;
        addedLine.pairId = pairId;
        addedLine.inlineDiff = inlineDiff;
        pairId += 1;
        modified += 1;
      }
    }
  }

  return { added, removed, modified };
}

function similarity(left: string, right: string) {
  const maxLength = Math.max(left.length, right.length);
  if (maxLength === 0) return 1;
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  const current = Array(right.length + 1).fill(0);
  for (let i = 1; i <= left.length; i += 1) {
    current[0] = i;
    for (let j = 1; j <= right.length; j += 1) {
      const cost = left[i - 1] === right[j - 1] ? 0 : 1;
      current[j] = Math.min(current[j - 1] + 1, previous[j] + 1, previous[j - 1] + cost);
    }
    previous.splice(0, previous.length, ...current);
  }
  return 1 - previous[right.length] / maxLength;
}

function buildInlineDiff(oldText: string, newText: string): InlineDiffPart[] {
  const lcs = Array.from({ length: oldText.length + 1 }, () => Array(newText.length + 1).fill(0));
  for (let i = oldText.length - 1; i >= 0; i -= 1) {
    for (let j = newText.length - 1; j >= 0; j -= 1) {
      lcs[i][j] = oldText[i] === newText[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }

  const parts: InlineDiffPart[] = [];
  let i = 0;
  let j = 0;
  while (i < oldText.length && j < newText.length) {
    if (oldText[i] === newText[j]) {
      pushInlinePart(parts, "unchanged", oldText[i]);
      i += 1;
      j += 1;
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      pushInlinePart(parts, "removed", oldText[i]);
      i += 1;
    } else {
      pushInlinePart(parts, "added", newText[j]);
      j += 1;
    }
  }
  while (i < oldText.length) pushInlinePart(parts, "removed", oldText[i]), (i += 1);
  while (j < newText.length) pushInlinePart(parts, "added", newText[j]), (j += 1);
  return parts;
}

function pushInlinePart(parts: InlineDiffPart[], type: InlineDiffPart["type"], text: string) {
  const previous = parts[parts.length - 1];
  if (previous?.type === type) {
    previous.text += text;
  } else {
    parts.push({ type, text });
  }
}

function clipContext(lines: StructuredDiffLine[], radius: number) {
  if (!lines.some((line) => line.type !== "context")) return lines;
  const keep = Array(lines.length).fill(false);
  lines.forEach((line, index) => {
    if (line.type !== "context") {
      for (let cursor = Math.max(0, index - radius); cursor <= Math.min(lines.length - 1, index + radius); cursor += 1) {
        keep[cursor] = true;
      }
    }
  });

  const clipped: StructuredDiffLine[] = [];
  for (let index = 0; index < lines.length; ) {
    if (keep[index]) {
      clipped.push(lines[index]);
      index += 1;
    } else {
      let foldedCount = 0;
      while (index < lines.length && !keep[index]) {
        foldedCount += 1;
        index += 1;
      }
      clipped.push({ type: "folded", foldedCount, text: "" });
    }
  }
  return clipped;
}

function parseUnifiedDiff(unifiedDiff?: string): DiffHunk[] {
  if (!unifiedDiff) return [];
  const hunks: DiffHunk[] = [];
  let current: DiffHunk | undefined;
  let oldLine = 0;
  let newLine = 0;

  for (const rawLine of unifiedDiff.split(/\r?\n/)) {
    if (rawLine.startsWith("diff --git") || rawLine.startsWith("index ") || rawLine.startsWith("---") || rawLine.startsWith("+++")) continue;
    const header = rawLine.match(/^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
    if (header) {
      current = { oldStart: Number(header[1]), newStart: Number(header[2]), lines: [] };
      hunks.push(current);
      oldLine = Number(header[1]);
      newLine = Number(header[2]);
      continue;
    }
    if (!current) current = { lines: [] }, hunks.push(current);
    if (rawLine.startsWith("-")) current.lines.push(makeLine("removed", rawLine.slice(1), oldLine++));
    else if (rawLine.startsWith("+")) current.lines.push(makeLine("added", rawLine.slice(1), undefined, newLine++));
    else current.lines.push(makeLine("context", rawLine.startsWith(" ") ? rawLine.slice(1) : rawLine, oldLine++, newLine++));
  }
  return hunks;
}

function hunksForDiff(diff?: DiffPayload, expanded = false) {
  if (!diff) return [];
  if (expanded && (diff.oldText != null || diff.newText != null)) return buildDiffLines(diff.oldText, diff.newText, Number.POSITIVE_INFINITY).hunks;
  if (diff.hunks?.length) return diff.hunks;
  if (diff.format === "UNIFIED") return parseUnifiedDiff(diff.unifiedDiff);
  return buildDiffLines(diff.oldText, diff.newText).hunks;
}

function flattenHunks(hunks: DiffHunk[]) {
  return hunks.flatMap((hunk) => hunk.lines ?? []);
}

function toSideRows(lines: StructuredDiffLine[]): SideRow[] {
  const rows: SideRow[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (line.type === "folded") {
      rows.push({ kind: "folded", foldedCount: line.foldedCount });
      continue;
    }
    if (line.type === "context") {
      rows.push({ kind: "line", oldLine: line, newLine: line });
      continue;
    }
    if (line.type === "removed" && lines[index + 1]?.type === "added" && lines[index + 1].pairId && lines[index + 1].pairId === line.pairId) {
      rows.push({ kind: "line", oldLine: line, newLine: lines[index + 1] });
      index += 1;
      continue;
    }
    rows.push(line.type === "removed" ? { kind: "line", oldLine: line } : { kind: "line", newLine: line });
  }
  return rows;
}

function lineTone(type?: StructuredDiffLine["type"]) {
  return cn(
    type === "added" && "bg-emerald-500/12 text-emerald-100",
    type === "removed" && "bg-red-500/14 text-red-100",
    type === "context" && "text-white/58"
  );
}

function renderCode(line?: StructuredDiffLine, side?: "old" | "new") {
  if (!line) return <span>&nbsp;</span>;
  const text = line.text || " ";
  if (!line.inlineDiff?.length || line.type === "context") return <span>{text}</span>;
  const visibleTypes = side === "old" || line.type === "removed" ? new Set(["unchanged", "removed"]) : new Set(["unchanged", "added"]);
  return (
    <>
      {line.inlineDiff.filter((part) => visibleTypes.has(part.type)).map((part, index) => (
        <span
          key={`${index}-${part.type}-${part.text}`}
          className={cn(
            part.type === "removed" && "rounded-[3px] bg-red-500/40 text-red-50",
            part.type === "added" && "rounded-[3px] bg-emerald-500/38 text-emerald-50"
          )}
        >
          {part.text}
        </span>
      ))}
    </>
  );
}

function FoldedRow({ count, onExpand }: { count?: number; onExpand: () => void }) {
  return (
    <button
      type="button"
      onClick={onExpand}
      className="flex w-full items-center gap-2 border-y border-white/8 bg-white/[0.035] px-4 py-1.5 font-mono text-[12px] text-white/50 hover:bg-white/[0.06] hover:text-white/75"
    >
      <span className="text-white/35">...</span>
      <span>展开 {count ?? 0} 行</span>
    </button>
  );
}

function UnifiedView({ lines, onExpand }: { lines: StructuredDiffLine[]; onExpand: () => void }) {
  return (
    <div className="font-mono text-[12.5px] leading-5">
      {lines.map((line, index) =>
        line.type === "folded" ? (
          <FoldedRow key={`fold-${index}-${line.foldedCount}`} count={line.foldedCount} onExpand={onExpand} />
        ) : (
          <div key={`${index}-${line.type}-${line.oldLineNumber}-${line.newLineNumber}`} className={cn("grid min-w-max grid-cols-[52px_52px_28px_minmax(0,1fr)] px-3", lineTone(line.type))}>
            <span className="select-none text-right text-white/35">{line.oldLineNumber ?? ""}</span>
            <span className="select-none text-right text-white/35">{line.newLineNumber ?? ""}</span>
            <span className="select-none text-center text-white/45">{line.type === "added" ? "+" : line.type === "removed" ? "-" : " "}</span>
            <span className="whitespace-pre-wrap break-words py-0.5">{renderCode(line)}</span>
          </div>
        )
      )}
    </div>
  );
}

function SplitCell({ line, side }: { line?: StructuredDiffLine; side: "old" | "new" }) {
  return (
    <div className={cn("grid min-w-0 grid-cols-[52px_28px_minmax(0,1fr)] px-3", lineTone(line?.type))}>
      <span className="select-none text-right text-white/35">{side === "old" ? line?.oldLineNumber ?? "" : line?.newLineNumber ?? ""}</span>
      <span className="select-none text-center text-white/45">{line?.type === "added" ? "+" : line?.type === "removed" ? "-" : " "}</span>
      <span className="min-w-0 whitespace-pre-wrap break-words py-0.5">{renderCode(line, side)}</span>
    </div>
  );
}

function SplitView({ rows, onExpand }: { rows: SideRow[]; onExpand: () => void }) {
  return (
    <div className="min-w-[720px] font-mono text-[12.5px] leading-5">
      <div className="grid grid-cols-2 border-b border-white/8 px-3 py-1 text-[11px] uppercase tracking-normal text-white/38">
        <span>原文件</span>
        <span>新文件</span>
      </div>
      {rows.map((row, index) =>
        row.kind === "folded" ? (
          <FoldedRow key={`fold-split-${index}-${row.foldedCount}`} count={row.foldedCount} onExpand={onExpand} />
        ) : (
          <div key={`split-${index}`} className="grid grid-cols-2">
            <SplitCell line={row.oldLine} side="old" />
            <SplitCell line={row.newLine} side="new" />
          </div>
        )
      )}
    </div>
  );
}

export function CodeDiffPanel({
  diff,
  path,
  className,
  emptyLabel = "后端未提供 diff 数据"
}: {
  diff?: DiffPayload;
  path?: string;
  className?: string;
  emptyLabel?: string;
}) {
  const [viewMode, setViewMode] = useState<ViewMode>("unified");
  const [expanded, setExpanded] = useState(false);
  const filePath = path || diff?.path || pathFromUnifiedDiff(diff?.unifiedDiff);
  const stats = diffLineStats(diff);
  const hunks = useMemo(() => hunksForDiff(diff, expanded), [diff, expanded]);
  const lines = useMemo(() => flattenHunks(hunks), [hunks]);
  const sideRows = useMemo(() => toSideRows(lines), [lines]);
  const hasFolded = lines.some((line) => line.type === "folded");

  return (
    <div className={cn("overflow-hidden rounded-[8px] border border-white/10 bg-[#1d1f21] shadow-insetline", className)}>
      <div className="flex min-w-0 items-center justify-between gap-3 border-b border-white/10 px-4 py-2">
        <span className="min-w-0 truncate font-mono text-[13px] font-semibold text-white/85">{basename(filePath)}</span>
        <div className="flex shrink-0 items-center gap-3">
          <span className="font-mono text-[12px] text-white/55">
            +{stats.added} -{stats.removed}
          </span>
          <div className="flex rounded-[6px] border border-white/10 bg-black/20 p-0.5" aria-label="diff 视图切换">
            <button
              type="button"
              title="统一视图"
              onClick={() => setViewMode("unified")}
              className={cn("flex h-7 w-8 items-center justify-center rounded-[4px] text-white/48 hover:text-white/80", viewMode === "unified" && "bg-white/10 text-white")}
            >
              <Rows3 size={15} />
            </button>
            <button
              type="button"
              title="并排视图"
              onClick={() => setViewMode("split")}
              className={cn("flex h-7 w-8 items-center justify-center rounded-[4px] text-white/48 hover:text-white/80", viewMode === "split" && "bg-white/10 text-white")}
            >
              <Columns2 size={15} />
            </button>
          </div>
        </div>
      </div>
      {lines.length === 0 ? (
        <div className="px-4 py-3 font-mono text-xs text-white/45">{emptyLabel}</div>
      ) : (
        <div className="max-h-[420px] overflow-auto py-2">
          {viewMode === "unified" ? <UnifiedView lines={lines} onExpand={() => setExpanded(true)} /> : <SplitView rows={sideRows} onExpand={() => setExpanded(true)} />}
          {expanded && hasFolded ? <div className="px-4 py-2 font-mono text-[12px] text-white/35">已展开全部上下文</div> : null}
        </div>
      )}
    </div>
  );
}
