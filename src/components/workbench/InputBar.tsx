import { AtSign, ChevronDown, Send, Square, X } from "lucide-react";
import { useRef } from "react";
import { Textarea } from "@/components/ui/textarea";
import { useAgentStore } from "@/store/agentStore";

export function InputBar() {
  const prompt = useAgentStore((state) => state.prompt);
  const selectedLocalFile = useAgentStore((state) => state.selectedLocalFile);
  const status = useAgentStore((state) => state.status);
  const selectedModel = useAgentStore((state) => state.selectedModel);
  const allowedModels = useAgentStore((state) => state.allowedModels);
  const setPrompt = useAgentStore((state) => state.setPrompt);
  const setSelectedModel = useAgentStore((state) => state.setSelectedModel);
  const setSelectedLocalFile = useAgentStore((state) => state.setSelectedLocalFile);
  const startRun = useAgentStore((state) => state.startRun);
  const stopRun = useAgentStore((state) => state.stopRun);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const running = ["CONNECTING", "RUNNING", "WAITING_APPROVAL", "RESUMING"].includes(status);

  return (
    <footer className="shrink-0 bg-[#0e0e11] px-4 pb-4 pt-2">
      <div className="mx-auto max-w-6xl rounded-[16px] border border-white/[0.1] bg-white/[0.035] p-2.5 shadow-[0_14px_40px_rgba(0,0,0,.2),inset_0_1px_0_rgba(255,255,255,.035)] focus-within:border-primary/35">
        <Textarea
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return;
            event.preventDefault();
            if (!running && prompt.trim()) void startRun();
          }}
          rows={2}
          maxLength={4000}
          placeholder="输入消息，或输入 / 调用命令…"
          className="min-h-[58px] resize-none border-0 bg-transparent px-2 py-1.5 text-[13px] leading-6 shadow-none focus-visible:ring-0 placeholder:text-white/27"
        />

        <div className="flex min-w-0 items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={(event) => setSelectedLocalFile(event.currentTarget.files?.[0])}
          />

          {selectedLocalFile ? (
            <span className="inline-flex h-7 min-w-0 max-w-[220px] items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-2.5 text-[10.5px] text-primary">
              <AtSign size={12} />
              <span className="truncate">{selectedLocalFile.relativePath || selectedLocalFile.name}</span>
              <button type="button" className="shrink-0 text-primary/60 hover:text-primary" onClick={() => setSelectedLocalFile()}>
                <X size={11} />
              </button>
            </span>
          ) : (
            <button
              type="button"
              className="inline-flex h-7 items-center gap-1.5 rounded-full border border-white/[0.09] bg-white/[0.035] px-2.5 text-[10.5px] text-white/48 transition hover:border-primary/25 hover:text-primary"
              onClick={() => fileInputRef.current?.click()}
            >
              <AtSign size={12} />
              文件
            </button>
          )}

          <label className="relative inline-flex h-7 min-w-0 max-w-[170px] items-center rounded-full border border-white/[0.09] bg-white/[0.035] text-[10.5px] text-white/48">
            <select
              value={selectedModel}
              onChange={(event) => setSelectedModel(event.target.value)}
              aria-label="选择模型"
              className="h-full min-w-0 appearance-none bg-transparent py-0 pl-2.5 pr-7 outline-none"
            >
              {allowedModels.map((model) => (
                <option key={model} value={model} className="bg-[#18181b]">
                  {model}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 text-white/30" size={11} />
          </label>

          <button
            type="button"
            className={`ml-auto flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] transition ${
              running
                ? "bg-red-400/15 text-red-300 hover:bg-red-400/22"
                : "bg-[#F3A04C] text-[#1b1209] shadow-[0_8px_20px_rgba(229,133,34,.22)] hover:bg-[#ffad58] disabled:cursor-not-allowed disabled:opacity-35"
            }`}
            title={running ? "停止" : "发送"}
            disabled={!running && !prompt.trim()}
            onClick={() => (running ? stopRun() : void startRun())}
          >
            {running ? <Square size={14} fill="currentColor" /> : <Send size={15} fill="currentColor" />}
          </button>
        </div>
      </div>
    </footer>
  );
}
