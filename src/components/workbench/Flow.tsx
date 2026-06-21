import { AlertTriangle, Bot, ChevronRight, FileDiff, MessageSquare, TerminalSquare } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { tryStringify } from "@/lib/utils";
import { useAgentStore, type StepState } from "@/store/agentStore";
import type { AgentStreamEvent } from "@/types/backend";
import { AnswerMarkdown } from "./AnswerMarkdown";
import { DiffApprovalCard } from "./DiffApprovalCard";

function StepCard({ step }: { step: StepState }) {
  return (
    <div className="rounded border border-border bg-[#0c0e10] p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <ChevronRight className="text-primary" size={15} />
          <span className="font-mono text-xs text-muted-foreground">step {step.step}</span>
          {step.tool ? <Badge>{step.tool}</Badge> : null}
        </div>
        <Badge>{step.status}</Badge>
      </div>

      {step.thought ? <p className="mb-3 text-sm leading-6 text-foreground">{step.thought}</p> : null}

      {step.input ? (
        <pre className="mb-3 max-h-56 overflow-auto rounded border border-border bg-[#080a0c] p-3 font-mono text-xs text-muted-foreground">
          {tryStringify(step.input)}
        </pre>
      ) : null}

      {step.observation ? (
        <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded border border-border bg-[#080a0c] p-3 font-mono text-xs leading-5 text-muted-foreground">
          {step.observation}
        </pre>
      ) : null}

      {step.truncated ? <div className="mt-2 font-mono text-[11px] text-primary">truncated</div> : null}
      {step.unifiedDiff ? (
        <pre className="mt-3 max-h-72 overflow-auto rounded border border-emerald-900/50 bg-[#07100c] p-3 font-mono text-xs text-emerald-100">
          {step.unifiedDiff}
        </pre>
      ) : null}
    </div>
  );
}

function EventMarker({ event }: { event: AgentStreamEvent }) {
  if (event.type === "policy_denied") {
    return (
      <div className="rounded border border-red-500/35 bg-red-950/20 p-3">
        <div className="mb-1 flex items-center gap-2 font-mono text-sm text-red-300">
          <AlertTriangle size={15} />
          policy_denied
        </div>
        <div className="text-sm text-muted-foreground">{event.riskReason}</div>
      </div>
    );
  }

  if (event.type === "error") {
    return (
      <div className="rounded border border-red-500/35 bg-red-950/20 p-3">
        <div className="mb-1 flex items-center gap-2 font-mono text-sm text-red-300">
          <AlertTriangle size={15} />
          error
        </div>
        <div className="text-sm text-muted-foreground">{event.message || event.code}</div>
      </div>
    );
  }

  return null;
}

export function Flow() {
  const prompt = useAgentStore((state) => state.prompt);
  const steps = useAgentStore((state) => state.steps);
  const approvals = useAgentStore((state) => state.approvals);
  const answer = useAgentStore((state) => state.answer);
  const error = useAgentStore((state) => state.error);
  const events = useAgentStore((state) => state.events);

  return (
    <main className="min-h-0 flex-1 overflow-auto bg-[#090b0d]">
      <div className="mx-auto flex max-w-5xl flex-col gap-3 px-4 py-4">
        {prompt ? (
          <div className="rounded border border-border bg-[#0c0e10] p-3">
            <div className="mb-2 flex items-center gap-2 font-mono text-xs text-muted-foreground">
              <MessageSquare size={14} />
              user
            </div>
            <div className="whitespace-pre-wrap text-sm leading-6">{prompt}</div>
          </div>
        ) : null}

        {steps.length === 0 && !error ? (
          <div className="flex min-h-[42vh] items-center justify-center rounded border border-dashed border-border bg-[#0c0e10]">
            <div className="text-center">
              <TerminalSquare className="mx-auto mb-3 text-primary" size={28} />
              <div className="font-mono text-sm text-muted-foreground">Awaiting run</div>
            </div>
          </div>
        ) : null}

        {steps.map((step) => (
          <StepCard key={step.step} step={step} />
        ))}

        {Object.values(approvals).map((approval) => (
          <DiffApprovalCard key={approval.approvalId} approval={approval} />
        ))}

        {events.map(({ id, event }) => (
          <EventMarker key={id} event={event} />
        ))}

        {answer ? (
          <div className="rounded border border-emerald-500/25 bg-[#0b100d] p-3">
            <div className="mb-2 flex items-center gap-2 font-mono text-xs text-emerald-300">
              <Bot size={14} />
              answer
            </div>
            <AnswerMarkdown content={answer} />
          </div>
        ) : null}

        {error ? (
          <div className="rounded border border-red-500/35 bg-red-950/20 p-3">
            <div className="mb-1 flex items-center gap-2 font-mono text-sm text-red-300">
              <FileDiff size={15} />
              run error
            </div>
            <div className="text-sm text-muted-foreground">{error}</div>
          </div>
        ) : null}
      </div>
    </main>
  );
}
