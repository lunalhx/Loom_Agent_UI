import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function shortId(value?: string) {
  if (!value) return "n/a";
  return value.length > 10 ? `${value.slice(0, 6)}...${value.slice(-4)}` : value;
}

export function formatTime(date = new Date()) {
  return new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).format(date);
}

export function tryStringify(value: unknown) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export function compactText(value?: string, maxLength = 140) {
  if (!value) return "";
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, Math.max(0, maxLength - 1)).trim()}...`;
}

export function summarizeParams(input?: Record<string, unknown>) {
  if (!input) return "";
  const entries = Object.entries(input).slice(0, 4);
  if (entries.length === 0) return "";
  return entries
    .map(([key, value]) => {
      if (typeof value === "string") return `${key}=${compactText(value, 42)}`;
      if (typeof value === "number" || typeof value === "boolean") return `${key}=${String(value)}`;
      if (value === null) return `${key}=null`;
      if (Array.isArray(value)) return `${key}=[${value.length}]`;
      return `${key}={...}`;
    })
    .join(" ");
}

export function summarizeObservation(text?: string, maxLength = 150) {
  if (!text) return "";
  const firstUsefulLine = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean);
  return compactText(firstUsefulLine || text, maxLength);
}

export function clipMultiline(text: string, maxLines = 16, maxChars = 2800) {
  const lines = text.split(/\r?\n/);
  const clippedLines = lines.slice(0, maxLines).join("\n");
  const clipped = clippedLines.length > maxChars ? `${clippedLines.slice(0, maxChars).trimEnd()}\n...` : clippedLines;
  return {
    text: lines.length > maxLines || text.length > maxChars ? `${clipped}\n...` : clipped,
    clipped: lines.length > maxLines || text.length > maxChars
  };
}

export function basename(path?: string) {
  if (!path) return "pending file";
  return path.split(/[\\/]/).filter(Boolean).pop() || path;
}

export function diffLineStats(diff?: { format: "OLD_NEW" | "UNIFIED"; oldText?: string; newText?: string; unifiedDiff?: string }) {
  if (!diff) return { added: 0, removed: 0 };
  if (diff.format === "UNIFIED") {
    const lines = diff.unifiedDiff?.split(/\r?\n/) ?? [];
    return lines.reduce(
      (stats, line) => {
        if (line.startsWith("+") && !line.startsWith("+++")) stats.added += 1;
        if (line.startsWith("-") && !line.startsWith("---")) stats.removed += 1;
        return stats;
      },
      { added: 0, removed: 0 }
    );
  }

  const oldLines = diff.oldText ? diff.oldText.split(/\r?\n/) : [];
  const newLines = diff.newText ? diff.newText.split(/\r?\n/) : [];
  return {
    added: Math.max(0, newLines.length - oldLines.length) || (diff.newText && diff.newText !== diff.oldText ? newLines.length : 0),
    removed: Math.max(0, oldLines.length - newLines.length) || (diff.newText && diff.newText !== diff.oldText ? oldLines.length : 0)
  };
}

export function isWriteTool(tool?: string) {
  return tool === "replace_in_file" || tool === "write_file" || tool === "edit_file";
}

export function extractPaths(text?: string) {
  if (!text) return [];
  const matches = text.matchAll(/(?:^|\s)([./\w-]+\/[\w./-]+\.[A-Za-z0-9]+)(?::\d+)?/gm);
  return Array.from(new Set(Array.from(matches, (match) => match[1]))).slice(0, 24);
}

export function extractUnifiedDiff(text?: string) {
  if (!text) return undefined;
  const outputIndex = text.indexOf("Output:");
  const source = outputIndex >= 0 ? text.slice(outputIndex + "Output:".length) : text;
  const diffIndex = source.search(/^diff --git|^---\s/m);
  return diffIndex >= 0 ? source.slice(diffIndex).trim() : undefined;
}
