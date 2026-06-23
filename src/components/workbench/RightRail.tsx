import { Clock3, ListTodo, Route } from "lucide-react";
import { useAgentStore, type PlanItem } from "@/store/agentStore";
import { cn } from "@/lib/utils";

function PlanIcon({ status }: { status: PlanItem["status"] }) {
  return (
    <span
      className={cn(
        "mt-0.5 h-4 w-4 shrink-0 rounded-full border-2",
        status === "done" && "border-emerald-400 bg-emerald-400",
        status === "doing" && "border-primary bg-[radial-gradient(circle,hsl(var(--primary))_38%,transparent_42%)]",
        status === "blocked" && "border-red-400 bg-red-400/20",
        status === "skipped" && "border-white/20 bg-white/5",
        status === "pending" && "border-white/24"
      )}
    />
  );
}

function traceColor(status?: string) {
  if (status === "done") return "border-emerald-500/45";
  if (status === "error") return "border-red-500/55";
  if (status === "blocked") return "border-amber-400/55";
  if (status === "running") return "border-primary/60";
  return "border-border";
}

export function RightRail() {
  const plan = useAgentStore((state) => state.plan);
  const trace = useAgentStore((state) => state.trace);

  return (
    <aside className="panel-edge hidden min-h-0 w-[286px] shrink-0 border-l bg-[#1d1e20] xl:flex xl:flex-col">
      <section className="min-h-0 border-b border-border/80 p-4">
        <div className="mb-4 flex items-center gap-2 text-[13px] font-semibold text-white/52">
          <ListTodo size={13} />
          执行计划
        </div>
        <div className="max-h-[42vh] space-y-3 overflow-auto pr-1">
          {plan.length === 0 ? (
            <div className="rounded-[10px] border border-dashed border-white/12 p-3 text-xs text-muted-foreground">等待生成 todo 计划</div>
          ) : (
            plan.map((item) => (
              <div key={item.id} className="flex gap-3">
                <PlanIcon status={item.status} />
                <div className="min-w-0 flex-1">
                  <div
                    className={cn(
                      "truncate text-[13px] font-semibold leading-5",
                      item.status === "done" && "text-white/34 line-through",
                      item.status === "doing" && "text-primary",
                      item.status === "blocked" && "text-red-300",
                      item.status === "pending" && "text-white/54",
                      item.status === "skipped" && "text-white/28 line-through"
                    )}
                  >
                    {item.title}
                  </div>
                  <div className="mt-0.5 flex items-center gap-2 font-mono text-[10.5px] text-white/32">
                    <span>{item.status}</span>
                    {item.detail ? <span className="truncate">{item.detail}</span> : null}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="min-h-0 flex-1 p-4">
        <div className="mb-4 flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.12em] text-white/34">
          <Route size={13} />
          Trace
        </div>
        <div className="space-y-2.5 overflow-auto pr-1">
          {trace.length === 0 ? (
            <div className="rounded-[10px] border border-dashed border-white/12 p-3 text-xs text-muted-foreground">暂无 trace</div>
          ) : (
            trace.map((item) => (
              <div key={item.id} className={`border-l-2 pl-3 ${traceColor(item.status)}`}>
                <div className="flex min-w-0 items-center gap-2">
                  <span className="flex shrink-0 items-center gap-1 font-mono text-[11px] text-white/34">
                    <Clock3 size={11} />
                    {item.time}
                  </span>
                  <span className="truncate font-mono text-[11.5px] text-white/52">{item.label}</span>
                </div>
                {item.detail ? <div className="mt-1 truncate font-mono text-[10.5px] text-white/28">{item.detail}</div> : null}
              </div>
            ))
          )}
        </div>
      </section>
    </aside>
  );
}
