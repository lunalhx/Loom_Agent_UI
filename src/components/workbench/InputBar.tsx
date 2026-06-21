import { FileSearch, Play, Square, TestTube2, X } from "lucide-react";
import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { approvalRun, normalRun, policyDeniedRun } from "@/lib/mockEvents";
import { useAgentStore } from "@/store/agentStore";

export function InputBar() {
  const prompt = useAgentStore((state) => state.prompt);
  const maxSteps = useAgentStore((state) => state.maxSteps);
  const selectedLocalFile = useAgentStore((state) => state.selectedLocalFile);
  const status = useAgentStore((state) => state.status);
  const setPrompt = useAgentStore((state) => state.setPrompt);
  const setMaxSteps = useAgentStore((state) => state.setMaxSteps);
  const setSelectedLocalFile = useAgentStore((state) => state.setSelectedLocalFile);
  const startRun = useAgentStore((state) => state.startRun);
  const stopRun = useAgentStore((state) => state.stopRun);
  const replayMock = useAgentStore((state) => state.replayMock);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const running = ["CONNECTING", "RUNNING", "WAITING_APPROVAL", "RESUMING"].includes(status);

  return (
    <footer className="panel-edge shrink-0 border-t p-3">
      <div className="mx-auto grid max-w-5xl gap-2">
        <Textarea
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          rows={3}
          maxLength={4000}
          placeholder="Ask the coding agent"
        />
        <div className="grid gap-2 md:grid-cols-[1fr_110px_auto]">
          <div className="grid gap-1.5">
            <div className="flex min-w-0 gap-2">
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={(event) => setSelectedLocalFile(event.currentTarget.files?.[0])}
              />
              <Button variant="secondary" size="icon" title="Choose local file" onClick={() => fileInputRef.current?.click()}>
                <FileSearch size={15} />
              </Button>
              {selectedLocalFile ? (
                <div className="flex h-8 min-w-0 flex-1 items-center justify-between gap-2 rounded border border-primary/30 bg-primary/10 px-2 font-mono text-xs text-primary">
                  <span className="truncate">{selectedLocalFile.relativePath || selectedLocalFile.name}</span>
                  <button
                    type="button"
                    className="shrink-0 text-muted-foreground hover:text-foreground"
                    title="Clear selected file"
                    onClick={() => setSelectedLocalFile()}
                  >
                    <X size={13} />
                  </button>
                </div>
              ) : (
                <div className="flex h-8 min-w-0 flex-1 items-center rounded border border-dashed border-border px-2 font-mono text-xs text-muted-foreground">
                  Attach a file for context
                </div>
              )}
            </div>
          </div>
          <Input
            value={maxSteps}
            onChange={(event) => setMaxSteps(Math.max(1, Math.min(12, Number(event.target.value) || 1)))}
            type="number"
            min={1}
            max={12}
            aria-label="max steps"
          />
          <div className="flex items-center gap-2">
            {running ? (
              <Button variant="destructive" onClick={stopRun}>
                <Square size={15} />
                Stop
              </Button>
            ) : (
              <Button onClick={() => void startRun()}>
                <Play size={15} />
                Run
              </Button>
            )}
            <Button variant="secondary" size="icon" title="Replay normal mock" onClick={() => replayMock(normalRun)}>
              <TestTube2 size={15} />
            </Button>
            <Button variant="outline" size="sm" onClick={() => replayMock(approvalRun)}>
              HITL
            </Button>
            <Button variant="outline" size="sm" onClick={() => replayMock(policyDeniedRun)}>
              Deny
            </Button>
          </div>
        </div>
      </div>
    </footer>
  );
}
