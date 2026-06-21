import type { RunStatus } from "@/types/backend";

export function statusColor(status: RunStatus) {
  switch (status) {
    case "RUNNING":
    case "COMPLETED":
      return "bg-emerald-400";
    case "WAITING_APPROVAL":
    case "RESUMING":
    case "CONNECTING":
      return "bg-amber-400";
    case "ERROR":
    case "DISCONNECTED":
      return "bg-red-500";
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
    RESUMING: "resuming",
    COMPLETED: "done",
    ERROR: "error",
    DISCONNECTED: "offline",
    CANCELLED_LOCAL: "stopped"
  };
  return labels[status];
}
