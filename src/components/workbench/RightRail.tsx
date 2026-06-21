import { CheckCircle2, Circle, CircleDot, ListTodo, Route, XCircle } from "lucide-react";
import { useAgentStore } from "@/store/agentStore";

function PlanIcon({ status }: { status: string }) {
  if (status === "completed") return <CheckCircle2 className="text-emerald-400" size={14} />;
  if (status === "failed" || status === "blocked") return <XCircle className="text-red-400" size={14} />;
  if (status === "running") return <CircleDot className="text-primary" size={14} />;
  return <Circle className="text-muted-foreground" size={14} />;
}

export function RightRail() {
  const plan = useAgentStore((state) => state.plan);
  const trace = useAgentStore((state) => state.trace);

  return (
    <aside className="panel-edge hidden min-h-0 w-[310px] shrink-0 border-l xl:flex xl:flex-col">
      <section className="min-h-0 flex-1 border-b border-border/80 p-3">
        <div className="mono-label mb-3 flex items-center gap-2">
          <ListTodo size={13} />
          Plan
        </div>
        <div className="space-y-2 overflow-auto pr-1">
          {plan.length === 0 ? (
            <div className="rounded border border-dashed border-border p-3 text-xs text-muted-foreground">Waiting for trace</div>
          ) : (
            plan.map((item) => (
              <div key={item.id} className="flex gap-2 rounded border border-border bg-[#0b0d0f] p-2">
                <PlanIcon status={item.status} />
                <div className="min-w-0">
                  <div className="truncate text-sm">{item.title}</div>
                  <div className="font-mono text-[11px] text-muted-foreground">{item.status}</div>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="min-h-0 flex-1 p-3">
        <div className="mono-label mb-3 flex items-center gap-2">
          <Route size={13} />
          Trace
        </div>
        <div className="space-y-2 overflow-auto pr-1">
          {trace.length === 0 ? (
            <div className="rounded border border-dashed border-border p-3 text-xs text-muted-foreground">No nodes yet</div>
          ) : (
            trace.map((item) => (
              <div key={item.id} className="border-l border-border pl-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate font-mono text-xs text-foreground">{item.label}</span>
                  <span className="font-mono text-[11px] text-muted-foreground">{item.time}</span>
                </div>
                {item.detail ? <div className="mt-1 truncate font-mono text-[11px] text-muted-foreground">{item.detail}</div> : null}
              </div>
            ))
          )}
        </div>
      </section>
    </aside>
  );
}
