import { ChevronDown, ChevronRight, FileCode2, Folder, FolderCheck, FolderTree, History, Plus, RefreshCw } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAgentStore } from "@/store/agentStore";
import type { AgentWorkspaceTreeNode } from "@/types/backend";

function TreeNode({
  node,
  depth,
  expanded,
  onToggle
}: {
  node: AgentWorkspaceTreeNode;
  depth: number;
  expanded: Set<string>;
  onToggle: (node: AgentWorkspaceTreeNode) => void;
}) {
  const isDirectory = node.type === "directory";
  const isOpen = expanded.has(node.path);
  const indent = { paddingLeft: `${8 + depth * 12}px` };

  return (
    <div>
      <button
        type="button"
        className="flex h-7 w-full min-w-0 items-center gap-1 rounded pr-2 text-left text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
        style={indent}
        title={node.path || node.name}
        onClick={() => isDirectory && onToggle(node)}
      >
        {isDirectory ? (
          isOpen ? (
            <ChevronDown className="shrink-0" size={13} />
          ) : (
            <ChevronRight className="shrink-0" size={13} />
          )
        ) : (
          <span className="w-[13px] shrink-0" />
        )}
        {isDirectory ? (
          <Folder className="shrink-0 text-primary" size={13} />
        ) : (
          <FileCode2 className="shrink-0 text-muted-foreground" size={13} />
        )}
        <span className="truncate font-mono">{node.name}</span>
      </button>
      {isDirectory && isOpen && node.children?.length ? (
        <div>
          {node.children.map((child) => (
            <TreeNode key={`${child.type}:${child.path}`} node={child} depth={depth + 1} expanded={expanded} onToggle={onToggle} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function Sidebar({ open }: { open: boolean }) {
  const sessions = useAgentStore((state) => state.sessions);
  const activeSessionId = useAgentStore((state) => state.activeSessionId);
  const recentFiles = useAgentStore((state) => state.recentFiles);
  const workspace = useAgentStore((state) => state.workspace);
  const workspaceDisplayName = useAgentStore((state) => state.workspaceDisplayName);
  const workspaceMessage = useAgentStore((state) => state.workspaceMessage);
  const workspaceTree = useAgentStore((state) => state.workspaceTree);
  const workspaceTreeLoading = useAgentStore((state) => state.workspaceTreeLoading);
  const workspaceTreeError = useAgentStore((state) => state.workspaceTreeError);
  const setWorkspace = useAgentStore((state) => state.setWorkspace);
  const newSession = useAgentStore((state) => state.newSession);
  const selectSession = useAgentStore((state) => state.selectSession);
  const resolveCurrentWorkspace = useAgentStore((state) => state.resolveCurrentWorkspace);
  const loadWorkspaceTree = useAgentStore((state) => state.loadWorkspaceTree);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set([""]));

  const toggleNode = (node: AgentWorkspaceTreeNode) => {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(node.path)) {
        next.delete(node.path);
      } else {
        next.add(node.path);
        if (!node.children && node.hasChildren) void loadWorkspaceTree(node.path);
      }
      return next;
    });
  };

  return (
    <aside
      className={`panel-edge min-h-0 shrink-0 overflow-hidden border-r transition-[width,opacity] duration-200 ease-out ${
        open ? "w-[min(282px,42vw)] opacity-100" : "w-0 border-r-0 opacity-0"
      }`}
      aria-hidden={!open}
    >
      {open ? <div className="flex h-full w-[282px] flex-col">
      <section className="min-h-0 border-b border-border/80 p-3">
        <div className="mb-3 flex items-center justify-between">
          <div className="mono-label flex items-center gap-2">
            <History size={13} />
            Sessions
          </div>
          <div className="flex items-center gap-2">
            <Badge>{sessions.length}</Badge>
            <Button variant="secondary" size="icon" className="h-7 w-7" title="New session" onClick={newSession}>
              <Plus size={14} />
            </Button>
          </div>
        </div>
        <div className="max-h-56 space-y-1 overflow-auto pr-1">
          {sessions.length === 0 ? (
            <div className="rounded border border-dashed border-border p-3 text-xs text-muted-foreground">No local runs</div>
          ) : (
            sessions.map((session) => (
              <button
                key={session.id}
                type="button"
                className={`w-full rounded border px-2 py-2 text-left text-sm transition focus-ring ${
                  session.id === activeSessionId
                    ? "border-primary/40 bg-primary/10 text-foreground"
                    : "border-border bg-[#0b0d0f] text-muted-foreground hover:border-primary/25 hover:bg-primary/[0.06] hover:text-foreground"
                }`}
                title={session.title}
                aria-current={session.id === activeSessionId ? "true" : undefined}
                onClick={() => selectSession(session.id)}
              >
                <div className="truncate">{session.title}</div>
                <div className="mt-1 truncate font-mono text-[11px] text-muted-foreground">{session.workspace || "default"}</div>
              </button>
            ))
          )}
        </div>
      </section>

      <section className="min-h-0 flex-1 p-3">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="mono-label flex items-center gap-2">
            <FolderTree size={13} />
            Files
          </div>
          <div className="flex items-center gap-2">
            <Badge>{workspaceTree?.children?.length ?? recentFiles.length}</Badge>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              title="Refresh workspace tree"
              disabled={workspaceTreeLoading || !workspace.trim()}
              onClick={() => void resolveCurrentWorkspace()}
            >
              <RefreshCw size={14} />
            </Button>
          </div>
        </div>

        <div className="mb-3 grid gap-2">
          <div className="flex min-w-0 gap-2">
            <Input
              value={workspace}
              onChange={(event) => setWorkspace(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") void resolveCurrentWorkspace();
              }}
              placeholder="/Users/lunalhx/Desktop/Coding_Agent_Test"
              className="h-8 min-w-0 font-mono text-xs"
            />
            <Button
              variant="default"
              size="icon"
              className="h-8 w-8"
              title="Set workspace root"
              disabled={workspaceTreeLoading || !workspace.trim()}
              onClick={() => void resolveCurrentWorkspace()}
            >
              <FolderCheck size={14} />
            </Button>
          </div>
          {workspaceDisplayName ? (
            <div className="truncate font-mono text-[11px] text-primary">
              {workspaceDisplayName} · {workspaceMessage || "sandbox root"}
            </div>
          ) : null}
          {workspaceTreeError ? (
            <div className="rounded border border-destructive/40 bg-destructive/10 px-2 py-1.5 text-xs leading-5 text-destructive">
              {workspaceTreeError}
            </div>
          ) : null}
        </div>

        {workspaceTree ? (
          <div className="min-h-0 overflow-auto pr-1">
            <TreeNode node={workspaceTree} depth={0} expanded={expanded} onToggle={toggleNode} />
          </div>
        ) : workspace.trim() ? (
          <div className="rounded border border-dashed border-border bg-[#0b0d0f] p-4 text-sm leading-6 text-muted-foreground">
            Set the workspace root to load the tree
          </div>
        ) : recentFiles.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-[#0b0d0f] p-4 text-sm leading-6 text-muted-foreground">
            Enter a workspace path to load files
          </div>
        ) : (
          <div className="space-y-1 overflow-auto pr-1">
            {recentFiles.map((file) => (
              <div key={file} className="flex min-w-0 items-center gap-2 rounded px-2 py-1.5 text-xs text-muted-foreground hover:bg-muted">
                <FileCode2 className="shrink-0 text-primary" size={13} />
                <span className="truncate font-mono">{file}</span>
              </div>
            ))}
          </div>
        )}
      </section>
      </div>
      : null}
    </aside>
  );
}
