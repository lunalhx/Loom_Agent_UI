import { Check, ChevronDown, Clock3, MoveRight } from "lucide-react";
import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { useAgentStore, type PlanItem, type TraceItem } from "@/store/agentStore";

function PlanIcon({ status }: { status: PlanItem["status"] }) {
  if (status === "done") {
    return (
      <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-[5px] bg-[#5BBF5B]/20 text-[#73D173]">
        <Check size={11} strokeWidth={2.5} />
      </span>
    );
  }

  if (status === "doing") {
    return (
      <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-[5px] bg-primary/20 text-primary">
        <MoveRight size={11} strokeWidth={2.5} />
      </span>
    );
  }

  return (
    <span
      className={cn(
        "mt-0.5 h-4 w-4 shrink-0 rounded-[5px] border",
        status === "blocked" ? "border-red-400/55 bg-red-400/10" : "border-white/25 bg-white/[0.02]"
      )}
    />
  );
}

function traceDotColor(type: string) {
  if (type === "planner") return "bg-[#F3A04C]";
  if (type === "model_call") return "bg-[#B481BB]";
  if (type === "tool_call" || type === "tool_dispatch") return "bg-[#2DBBA0]";
  if (type === "plan_updated" || type === "final_answer") return "bg-[#5BBF5B]";
  return "bg-white/35";
}

function traceStage(items: TraceItem[]) {
  const types = new Set(items.map((item) => item.type));
  if (types.has("tool_call") || types.has("tool_dispatch")) return "推理 / 工具";
  if (types.has("planner") || types.has("plan_updated")) return "规划阶段";
  if (types.has("final_answer")) return "收尾";
  return "Agent loop";
}

function TraceGroup({ iteration, items }: { iteration: number; items: TraceItem[] }) {
  const [open, setOpen] = useState(true);

  return (
    <div className="overflow-hidden rounded-[12px] border border-white/[0.07] bg-white/[0.018]">
      <button
        type="button"
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left transition hover:bg-white/[0.035]"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <ChevronDown className={cn("text-white/35 transition-transform", !open && "-rotate-90")} size={14} />
        <span className="text-[12px] font-semibold text-white/72">循环 #{iteration}</span>
        <span className="ml-auto rounded-full bg-white/[0.055] px-2 py-0.5 text-[10px] text-white/38">{traceStage(items)}</span>
      </button>

      {open ? (
        <div className="px-3 pb-3 pl-5">
          {items.map((item, index) => (
            <div key={item.id} className="relative grid grid-cols-[minmax(0,1fr)_58px] items-center gap-2 py-1.5 pl-4">
              <span
                className={cn(
                  "absolute left-[3px] w-px bg-white/[0.09]",
                  index === 0 ? "top-1/2 bottom-0" : index === items.length - 1 ? "top-0 bottom-1/2" : "inset-y-0"
                )}
              />
              <span
                className={cn(
                  "absolute left-0 top-1/2 h-[7px] w-[7px] -translate-y-1/2 rounded-full ring-[3px] ring-[#151517]",
                  traceDotColor(item.type)
                )}
              />
              <span className="min-w-0 truncate font-mono text-[11px] text-white/58" title={item.detail || item.label}>
                {item.label}
              </span>
              <time className="text-right font-mono text-[10px] tabular-nums text-white/28">{item.time}</time>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function RightRail({ open }: { open: boolean }) {
  const plan = useAgentStore((state) => state.plan);
  const planTriggered = useAgentStore((state) => state.planTriggered);
  const trace = useAgentStore((state) => state.trace);
  const hasPlan = planTriggered && plan.length > 0;
  const completed = plan.filter((item) => item.status === "done" || item.status === "skipped").length;
  const traceGroups = useMemo(() => {
    const groups = new Map<number, TraceItem[]>();
    trace.slice(-100).forEach((item) => {
      const items = groups.get(item.iteration) || [];
      items.push(item);
      groups.set(item.iteration, items);
    });
    return Array.from(groups.entries()).sort(([a], [b]) => a - b);
  }, [trace]);

  return (
    <aside
      className={cn(
        "min-h-0 shrink-0 overflow-hidden bg-[#121214] transition-[width,opacity] duration-200 ease-out",
        open ? "w-[min(340px,44vw)] border-l border-white/[0.07] opacity-100" : "w-0 opacity-0"
      )}
      aria-hidden={!open}
    >
      {open ? <div className="flex h-full w-[340px] min-h-0 flex-col">
        <section className="border-b border-white/[0.07] p-4">
          <div className="mb-3 flex items-center">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.1em] text-white/48">执行计划</h2>
            <span className="ml-auto rounded-full bg-white/[0.055] px-2 py-0.5 font-mono text-[10px] tabular-nums text-white/38">
              {hasPlan ? `${completed}/${plan.length}` : "—"}
            </span>
          </div>

          {hasPlan ? (
            <div className="max-h-[250px] space-y-1 overflow-auto">
              {plan.map((item) => (
                <div
                  key={item.id}
                  className={cn(
                    "flex gap-2.5 rounded-[10px] px-2.5 py-2 text-[12px]",
                    item.status === "doing" && "bg-primary/[0.075]"
                  )}
                >
                  <PlanIcon status={item.status} />
                  <span
                    className={cn(
                      "min-w-0 leading-5",
                      item.status === "done" && "text-white/34 line-through",
                      item.status === "doing" && "font-medium text-primary",
                      item.status === "blocked" && "text-red-300/80",
                      item.status === "pending" && "text-white/54",
                      item.status === "skipped" && "text-white/28 line-through"
                    )}
                  >
                    {item.title}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex min-h-[136px] flex-col items-center justify-center rounded-[14px] border border-dashed border-white/[0.1] bg-white/[0.015] px-5 text-center">
              <span className="mb-3 flex h-9 w-9 items-center justify-center rounded-full bg-white/[0.045] text-white/35">
                <Clock3 size={17} strokeWidth={1.7} />
              </span>
              <div className="text-[12px] font-medium text-white/55">本次未触发计划</div>
              <div className="mt-1.5 text-[10.5px] leading-4 text-white/28">简单任务直接执行，仅多步任务才生成 Todo</div>
            </div>
          )}
        </section>

        <section className="min-h-0 flex-1 p-4">
          <div className="mb-3 flex items-center">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/48">Trace</h2>
            <span className="ml-auto rounded-full bg-white/[0.055] px-2 py-0.5 text-[10px] text-white/38">
              {traceGroups.length} 轮循环
            </span>
          </div>

          <div className="max-h-[390px] space-y-2 overflow-auto pr-0.5 xl:max-h-full">
            {traceGroups.length ? (
              traceGroups.map(([iteration, items]) => <TraceGroup key={iteration} iteration={iteration} items={items} />)
            ) : (
              <div className="rounded-[12px] border border-dashed border-white/[0.09] px-3 py-5 text-center font-mono text-[11px] text-white/25">
                暂无 trace
              </div>
            )}
          </div>
        </section>
      </div>
      : null}
    </aside>
  );
}
