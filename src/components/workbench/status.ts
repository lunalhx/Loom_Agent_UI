import type { RunStatus } from "@/types/backend";

export function statusColor(status: RunStatus) {
  switch (status) {
    case "RUNNING":
    case "COMPLETED":
      return "bg-emerald-400";
    case "WAITING_APPROVAL":
    case "WAITING_USER_INPUT":
    case "RESUMING":
    case "CONNECTING":
      return "bg-amber-400";
    case "BUDGET_EXCEEDED":
      return "bg-amber-500";
    case "ERROR":
    case "DISCONNECTED":
    case "FAILED":
      return "bg-red-500";
    case "CANCELLED":
    case "CANCELLED_LOCAL":
      return "bg-zinc-400";
    default:
      return "bg-zinc-600";
  }
}

export function statusLabel(status: RunStatus) {
  const labels: Record<RunStatus, string> = {
    IDLE: "idle",
    CONNECTING: "connecting",
    RUNNING: "running",
    WAITING_APPROVAL: "approval",
    WAITING_USER_INPUT: "awaiting input",
    RESUMING: "resuming",
    COMPLETED: "done",
    FAILED: "failed",
    BUDGET_EXCEEDED: "budget",
    CANCELLED: "cancelled",
    ERROR: "error",
    DISCONNECTED: "offline",
    CANCELLED_LOCAL: "stopped"
  };
  return labels[status];
}

export function statusIsRecoverable(status: RunStatus, recoverable?: boolean) {
  return Boolean(recoverable) && (status === "RUNNING" || status === "DISCONNECTED" || status === "FAILED" || status === "BUDGET_EXCEEDED");
}
