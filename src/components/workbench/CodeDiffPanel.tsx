import { basename, cn, diffLineStats } from "@/lib/utils";
import type { DiffPayload } from "@/types/backend";

type DiffLineKind = "add" | "remove" | "context" | "meta";

type DiffLine = {
  kind: DiffLineKind;
  sign: string;
  text: string;
};

function pathFromUnifiedDiff(unifiedDiff?: string) {
  if (!unifiedDiff) return undefined;
  const newFile = unifiedDiff.match(/^\+\+\+\s+b\/(.+)$/m)?.[1];
  const oldFile = unifiedDiff.match(/^---\s+a\/(.+)$/m)?.[1];
  return newFile || oldFile;
}

function unifiedLines(unifiedDiff?: string): DiffLine[] {
  if (!unifiedDiff) return [];
  return unifiedDiff
    .split(/\r?\n/)
    .filter((line) => !line.startsWith("diff --git") && !line.startsWith("index "))
    .map((line) => {
      if (line.startsWith("+") && !line.startsWith("+++")) return { kind: "add", sign: "+", text: line.slice(1) };
      if (line.startsWith("-") && !line.startsWith("---")) return { kind: "remove", sign: "-", text: line.slice(1) };
      if (line.startsWith("@@") || line.startsWith("---") || line.startsWith("+++")) return { kind: "meta", sign: " ", text: line };
      return { kind: "context", sign: " ", text: line || " " };
    });
}

function oldNewLines(oldText?: string, newText?: string): DiffLine[] {
  const oldLines = oldText ? oldText.split(/\r?\n/) : [];
  const newLines = newText ? newText.split(/\r?\n/) : [];
  return [
    ...oldLines.map((line) => ({ kind: "remove" as const, sign: "-", text: line || " " })),
    ...newLines.map((line) => ({ kind: "add" as const, sign: "+", text: line || " " }))
  ];
}

function diffLines(diff?: DiffPayload): DiffLine[] {
  if (!diff) return [];
  if (diff.format === "UNIFIED") return unifiedLines(diff.unifiedDiff);
  return oldNewLines(diff.oldText, diff.newText);
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
  const filePath = path || diff?.path || pathFromUnifiedDiff(diff?.unifiedDiff);
  const stats = diffLineStats(diff);
  const lines = diffLines(diff);

  return (
    <div className={cn("overflow-hidden rounded-[10px] border border-white/10 bg-[#202123] shadow-insetline", className)}>
      <div className="flex min-w-0 items-center justify-between gap-3 border-b border-white/10 px-4 py-2">
        <span className="min-w-0 truncate font-mono text-[13px] font-semibold text-white/85">{basename(filePath)}</span>
        <span className="shrink-0 font-mono text-[12px] text-white/55">
          +{stats.added} -{stats.removed}
        </span>
      </div>
      {lines.length === 0 ? (
        <div className="px-4 py-3 font-mono text-xs text-white/45">{emptyLabel}</div>
      ) : (
        <div className="max-h-[360px] overflow-auto py-2 font-mono text-[12.5px] leading-6">
          {lines.map((line, index) => (
            <div
              key={`${index}-${line.sign}-${line.text}`}
              className={cn(
                "grid min-w-max grid-cols-[32px_1fr] px-4",
                line.kind === "add" && "bg-emerald-500/14 text-emerald-200",
                line.kind === "remove" && "bg-red-500/16 text-red-200",
                line.kind === "meta" && "text-primary/85",
                line.kind === "context" && "text-white/48"
              )}
            >
              <span className="select-none text-white/45">{line.sign}</span>
              <span className="whitespace-pre">{line.text}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
