import { useCallback, useEffect, useRef, useState } from "react";
import { useAgentStore } from "@/store/agentStore";
import { Shield, Wrench, RefreshCw, AlertCircle, Check } from "lucide-react";

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
        className={`inline-flex items-center gap-1 rounded px-2.5 py-1 text-xs font-medium transition-colors
          ${isRunning ? "opacity-50 cursor-not-allowed" : "hover:bg-white/10"}
          ${skillsError ? "text-amber-400" : "text-gray-300"}
          ${open ? "bg-white/10" : ""}`}
        title="选择技能"
      >
        {skillsError ? (
          <AlertCircle className="h-3.5 w-3.5 text-amber-400" />
        ) : (
          <Wrench className="h-3.5 w-3.5" />
        )}
        <span>技能</span>
        {!skillsLoading && availableSkills.length > 0 && (
          <span className="text-[#F3A04C]">{selectedCount}</span>
        )}
        {hasProjectSelected && (
          <Shield className="h-3 w-3 text-amber-500/70" />
        )}
      </button>

      {open && (
        <div className="absolute bottom-full left-0 mb-2 w-80 rounded-lg border border-gray-700 bg-gray-900 shadow-xl z-50">
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-gray-700">
            <span className="text-sm font-medium text-gray-200">
              技能 ({selectedCount}/{availableSkills.length})
            </span>
            <button
              type="button"
              onClick={handleRefresh}
              disabled={skillsLoading}
              className="p-1 rounded hover:bg-white/10 text-gray-400 disabled:opacity-50"
              title="刷新"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${skillsLoading ? "animate-spin" : ""}`} />
            </button>
          </div>

          {/* Content */}
          <div className="max-h-64 overflow-y-auto p-2 space-y-1">
            {skillsLoading && (
              <div className="text-xs text-gray-500 text-center py-4">加载中...</div>
            )}
            {!skillsLoading && skillsError && (
              <div className="text-xs text-amber-400 text-center py-4">
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
              <div className="text-xs text-gray-500 text-center py-4">暂无可用技能</div>
            )}
            {!skillsLoading && !skillsError && availableSkills.length > 0 && (
              <>
                {/* User skills group */}
                {userSkills.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between px-1 py-1">
                      <span className="text-[10px] uppercase tracking-wider text-gray-500">用户技能</span>
                    </div>
                    {userSkills.map((skill) => (
                      <label
                        key={skill.name}
                        className={`flex items-start gap-2 px-2 py-1.5 rounded cursor-pointer transition-colors
                          ${isRunning ? "cursor-not-allowed opacity-60" : "hover:bg-white/5"}
                          ${selectedSkillNames.includes(skill.name) ? "bg-white/5" : ""}`}
                      >
                        <input
                          type="checkbox"
                          checked={selectedSkillNames.includes(skill.name)}
                          onChange={() => toggleSkill(skill.name)}
                          disabled={isRunning}
                          className="mt-0.5 h-3.5 w-3.5 rounded border-gray-600 bg-gray-800
                            text-[#F3A04C] focus:ring-[#F3A04C] focus:ring-offset-0"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-medium text-gray-200 truncate">{skill.name}</div>
                          {skill.description && (
                            <div className="text-[11px] text-gray-500 truncate">{skill.description}</div>
                          )}
                        </div>
                        <Check
                          className={`h-3.5 w-3.5 mt-0.5 flex-shrink-0
                            ${selectedSkillNames.includes(skill.name) ? "text-[#F3A04C]" : "text-transparent"}`}
                        />
                      </label>
                    ))}
                  </div>
                )}

                {/* Project skills group */}
                {projectSkills.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 px-1 py-1 mt-1">
                      <span className="text-[10px] uppercase tracking-wider text-gray-500">项目技能</span>
                      <span className="text-[10px] px-1 py-0.5 rounded bg-amber-500/20 text-amber-400">
                        需审批
                      </span>
                    </div>
                    {projectSkills.map((skill) => (
                      <label
                        key={skill.name}
                        className={`flex items-start gap-2 px-2 py-1.5 rounded cursor-pointer transition-colors
                          ${isRunning ? "cursor-not-allowed opacity-60" : "hover:bg-white/5"}
                          ${selectedSkillNames.includes(skill.name) ? "bg-white/5" : ""}`}
                      >
                        <input
                          type="checkbox"
                          checked={selectedSkillNames.includes(skill.name)}
                          onChange={() => toggleSkill(skill.name)}
                          disabled={isRunning}
                          className="mt-0.5 h-3.5 w-3.5 rounded border-gray-600 bg-gray-800
                            text-[#F3A04C] focus:ring-[#F3A04C] focus:ring-offset-0"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-medium text-gray-200 truncate">{skill.name}</div>
                          {skill.description && (
                            <div className="text-[11px] text-gray-500 truncate">{skill.description}</div>
                          )}
                        </div>
                        <Check
                          className={`h-3.5 w-3.5 mt-0.5 flex-shrink-0
                            ${selectedSkillNames.includes(skill.name) ? "text-[#F3A04C]" : "text-transparent"}`}
                        />
                      </label>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Footer actions */}
          {!skillsLoading && !skillsError && availableSkills.length > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 border-t border-gray-700">
              <button
                type="button"
                onClick={selectAllUserSkills}
                disabled={isRunning}
                className="text-[11px] text-gray-400 hover:text-gray-200 disabled:opacity-50 transition-colors"
              >
                全选用户技能
              </button>
              <button
                type="button"
                onClick={clearSelectedSkills}
                disabled={isRunning}
                className="text-[11px] text-gray-500 hover:text-gray-300 disabled:opacity-50 transition-colors"
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
