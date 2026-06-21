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
