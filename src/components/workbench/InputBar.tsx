import { FileSearch, Play, Square, X } from "lucide-react";
import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAgentStore } from "@/store/agentStore";

export function InputBar() {
  const prompt = useAgentStore((state) => state.prompt);
  const selectedLocalFile = useAgentStore((state) => state.selectedLocalFile);
  const status = useAgentStore((state) => state.status);
  const setPrompt = useAgentStore((state) => state.setPrompt);
  const setSelectedLocalFile = useAgentStore((state) => state.setSelectedLocalFile);
  const startRun = useAgentStore((state) => state.startRun);
  const stopRun = useAgentStore((state) => state.stopRun);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const running = ["CONNECTING", "RUNNING", "WAITING_APPROVAL", "RESUMING"].includes(status);

  return (
    <footer className="panel-edge shrink-0 border-t p-4">
      <div className="mx-auto grid max-w-6xl gap-3">
        <Textarea
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          rows={4}
          maxLength={4000}
          placeholder="Ask the coding agent"
          className="min-h-[132px] rounded-[12px] border-primary/45 bg-[#070c0d] px-4 py-4 text-[15px] shadow-[0_0_0_1px_rgba(243,160,76,0.12)] placeholder:text-white/40"
        />
        <div className="grid gap-3 md:grid-cols-[1fr_auto]">
          <div className="grid gap-1.5">
            <div className="flex min-w-0 gap-2">
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={(event) => setSelectedLocalFile(event.currentTarget.files?.[0])}
              />
              <Button variant="secondary" size="icon" className="h-10 w-10" title="Choose local file" onClick={() => fileInputRef.current?.click()}>
                <FileSearch size={15} />
              </Button>
              {selectedLocalFile ? (
                <div className="flex h-10 min-w-0 flex-1 items-center justify-between gap-2 rounded-[8px] border border-primary/30 bg-primary/10 px-3 font-mono text-xs text-primary">
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
                <div className="flex h-10 min-w-0 flex-1 items-center rounded-[8px] border border-dashed border-white/14 px-3 font-mono text-xs text-muted-foreground">
                  Attach a file for context
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {running ? (
              <Button variant="destructive" className="h-10 px-4" onClick={stopRun}>
                <Square size={15} />
                Stop
              </Button>
            ) : (
              <Button className="h-10 px-5 text-[15px] font-semibold" onClick={() => void startRun()}>
                <Play size={15} />
                Run
              </Button>
            )}
          </div>
        </div>
      </div>
    </footer>
  );
}
