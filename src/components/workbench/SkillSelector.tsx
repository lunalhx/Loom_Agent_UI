import { useCallback, useEffect, useRef, useState } from "react";
import { useAgentStore } from "@/store/agentStore";
import { Shield, Wrench, RefreshCw, AlertCircle, Check, Sparkles } from "lucide-react";

export default function SkillSelector() {
  const store = useAgentStore();
  const {
    availableSkills,
    selectedSkillNames,
    skillsLoading,
    skillsError,
    loadSkills,
    toggleSkill,
    selectAllUserSkills,
    clearSelectedSkills,
    status
  } = store;

  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const isRunning = status === "RUNNING" || status === "WAITING_APPROVAL" || status === "CONNECTING" || status === "RESUMING";

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleEscape);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  const handleRefresh = useCallback(() => {
    loadSkills();
  }, [loadSkills]);

  const selectedCount = selectedSkillNames.length;
  const hasProjectSkills = availableSkills.some((s) => s.source === "project");
  const hasProjectSelected = availableSkills.some(
    (s) => s.source === "project" && selectedSkillNames.includes(s.name)
  );

  const userSkills = availableSkills.filter((s) => s.source === "user");
  const projectSkills = availableSkills.filter((s) => s.source === "project");

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        disabled={isRunning}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={`focus-ring inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-[10.5px] transition
          ${isRunning ? "cursor-not-allowed opacity-50" : "hover:border-primary/25 hover:text-primary"}
          ${skillsError ? "border-amber-400/20 bg-amber-400/10 text-amber-400" : "border-white/[0.09] bg-white/[0.035] text-white/48"}
          ${open ? "border-primary/30 bg-primary/10 text-primary" : ""}`}
        title="选择技能"
      >
        {skillsError ? (
          <AlertCircle className="h-3.5 w-3.5 text-amber-400" />
        ) : (
          <Wrench className="h-3 w-3" />
        )}
        <span>技能</span>
        {!skillsLoading && availableSkills.length > 0 && (
          <span className={selectedCount > 0 ? "text-primary" : "text-white/30"}>{selectedCount}</span>
        )}
        {hasProjectSelected && (
          <Shield className="h-3 w-3 text-primary/70" />
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="选择技能"
          className="absolute bottom-full left-0 z-50 mb-3 w-[356px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-[16px] border border-white/[0.1] bg-[#151518]/[0.98] shadow-[0_24px_70px_rgba(0,0,0,.52),inset_0_1px_0_rgba(255,255,255,.045)] backdrop-blur-xl"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/[0.07] px-4 py-3.5">
            <div className="flex items-center gap-2.5">
              <span className="flex h-7 w-7 items-center justify-center rounded-[8px] border border-primary/20 bg-primary/10 text-primary">
                <Sparkles size={14} />
              </span>
              <div>
                <div className="text-[13px] font-medium text-white/90">选择技能</div>
                <div className="mt-0.5 text-[10.5px] text-white/35">为本次任务添加专业能力</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded-full border border-white/[0.07] bg-white/[0.035] px-2 py-1 font-mono text-[10px] text-white/40">
                {selectedCount} / {availableSkills.length}
              </span>
            <button
              type="button"
              onClick={handleRefresh}
              disabled={skillsLoading}
                className="focus-ring flex h-7 w-7 items-center justify-center rounded-[8px] text-white/35 transition hover:bg-white/[0.06] hover:text-white/70 disabled:opacity-50"
              title="刷新"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${skillsLoading ? "animate-spin" : ""}`} />
            </button>
            </div>
          </div>

          {/* Content */}
          <div className="max-h-[320px] space-y-4 overflow-y-auto p-3">
            {skillsLoading && (
              <div className="py-8 text-center text-xs text-white/35">加载中...</div>
            )}
            {!skillsLoading && skillsError && (
              <div className="py-8 text-center text-xs text-amber-400">
                {skillsError}
                <button
                  type="button"
                  onClick={handleRefresh}
                  className="ml-2 underline hover:text-amber-300"
                >
                  重试
                </button>
              </div>
            )}
            {!skillsLoading && !skillsError && availableSkills.length === 0 && (
              <div className="py-8 text-center text-xs text-white/35">暂无可用技能</div>
            )}
            {!skillsLoading && !skillsError && availableSkills.length > 0 && (
              <>
                {/* User skills group */}
                {userSkills.length > 0 && (
                  <div>
                    <div className="mb-1.5 flex items-center justify-between px-1">
                      <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-white/30">用户技能</span>
                      <span className="text-[10px] text-white/20">{userSkills.length} 项</span>
                    </div>
                    <div className="space-y-1">
                      {userSkills.map((skill) => (
                      <label
                        key={skill.name}
                        className={`group flex cursor-pointer items-start gap-2.5 rounded-[10px] border px-2.5 py-2.5 transition
                          ${isRunning ? "cursor-not-allowed opacity-60" : "hover:border-white/[0.1] hover:bg-white/[0.04]"}
                          ${selectedSkillNames.includes(skill.name) ? "border-primary/20 bg-primary/[0.075]" : "border-transparent"}`}
                      >
                        <input
                          type="checkbox"
                          checked={selectedSkillNames.includes(skill.name)}
                          onChange={() => toggleSkill(skill.name)}
                          disabled={isRunning}
                          className="peer sr-only"
                        />
                        <span className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-[5px] border transition
                          ${selectedSkillNames.includes(skill.name) ? "border-primary bg-primary text-primary-foreground" : "border-white/20 bg-white/[0.035] text-transparent group-hover:border-white/35"}`}>
                          <Check size={11} strokeWidth={3} />
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="truncate text-[12px] font-medium text-white/82">{skill.name}</div>
                          {skill.description && (
                            <div className="mt-0.5 truncate text-[10.5px] leading-4 text-white/32">{skill.description}</div>
                          )}
                        </div>
                      </label>
                      ))}
                    </div>
                  </div>
                )}

                {/* Project skills group */}
                {projectSkills.length > 0 && (
                  <div>
                    <div className="mb-1.5 flex items-center gap-2 px-1">
                      <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-white/30">项目技能</span>
                      <span className="rounded-full border border-primary/15 bg-primary/10 px-1.5 py-0.5 text-[9px] text-primary/80">
                        需审批
                      </span>
                      <span className="ml-auto text-[10px] text-white/20">{projectSkills.length} 项</span>
                    </div>
                    <div className="space-y-1">
                      {projectSkills.map((skill) => (
                      <label
                        key={skill.name}
                        className={`group flex cursor-pointer items-start gap-2.5 rounded-[10px] border px-2.5 py-2.5 transition
                          ${isRunning ? "cursor-not-allowed opacity-60" : "hover:border-white/[0.1] hover:bg-white/[0.04]"}
                          ${selectedSkillNames.includes(skill.name) ? "border-primary/20 bg-primary/[0.075]" : "border-transparent"}`}
                      >
                        <input
                          type="checkbox"
                          checked={selectedSkillNames.includes(skill.name)}
                          onChange={() => toggleSkill(skill.name)}
                          disabled={isRunning}
                          className="peer sr-only"
                        />
                        <span className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-[5px] border transition
                          ${selectedSkillNames.includes(skill.name) ? "border-primary bg-primary text-primary-foreground" : "border-white/20 bg-white/[0.035] text-transparent group-hover:border-white/35"}`}>
                          <Check size={11} strokeWidth={3} />
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <div className="truncate text-[12px] font-medium text-white/82">{skill.name}</div>
                            <Shield size={10} className="shrink-0 text-primary/45" />
                          </div>
                          {skill.description && (
                            <div className="mt-0.5 truncate text-[10.5px] leading-4 text-white/32">{skill.description}</div>
                          )}
                        </div>
                      </label>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Footer actions */}
          {!skillsLoading && !skillsError && availableSkills.length > 0 && (
            <div className="flex items-center gap-1 border-t border-white/[0.07] bg-black/10 px-3 py-2.5">
              <button
                type="button"
                onClick={selectAllUserSkills}
                disabled={isRunning}
                className="focus-ring rounded-[7px] px-2 py-1.5 text-[10.5px] text-white/40 transition hover:bg-white/[0.05] hover:text-white/75 disabled:opacity-50"
              >
                全选用户技能
              </button>
              <button
                type="button"
                onClick={clearSelectedSkills}
                disabled={isRunning}
                className="focus-ring rounded-[7px] px-2 py-1.5 text-[10.5px] text-white/28 transition hover:bg-white/[0.05] hover:text-white/60 disabled:opacity-50"
              >
                清空选择
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
