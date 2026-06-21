import type { AgentStreamEvent } from "@/types/backend";

export const normalRun: AgentStreamEvent[] = [
  {
    type: "meta",
    requestId: "mock-request-001",
    conversationId: "mock-conversation-001",
    workspace: "Loom_Agent_UI",
    stepCount: 3
  },
  { type: "node_start", node: "model_call", nodeInputs: ["currentPrompt", "requestId", "conversationId"] },
  { type: "thought", step: 1, thought: "先搜索工作区中的 React 入口与组件结构。" },
  { type: "tool_call", step: 1, tool: "code_search", input: { query: "createRoot", limit: 20 }, workspace: "Loom_Agent_UI" },
  {
    type: "observation",
    step: 1,
    tool: "code_search",
    observation: "src/main.tsx:4: createRoot(document.getElementById('root')!).render(<App />)",
    truncated: false
  },
  { type: "thought", step: 2, thought: "读取主界面文件并定位需要更新的状态。" },
  { type: "tool_call", step: 2, tool: "read_file", input: { path: "src/App.tsx" }, workspace: "Loom_Agent_UI" },
  { type: "observation", step: 2, tool: "read_file", observation: "src/App.tsx loaded", truncated: false },
  { type: "answer", answer: "完成检查。当前工作台已按事件流更新。```ts\nconst status = 'COMPLETED';\n```" },
  { type: "done", stopReason: "FINAL_ANSWER", stepCount: 2 }
];

export const approvalRun: AgentStreamEvent[] = [
  {
    type: "meta",
    requestId: "mock-request-approval",
    conversationId: "mock-conversation-approval",
    workspace: "Loom_Agent_UI",
    stepCount: 4
  },
  { type: "thought", step: 1, thought: "需要修改文件，先准备替换操作。" },
  {
    type: "tool_call",
    step: 1,
    tool: "replace_in_file",
    input: { path: "src/App.tsx", oldText: "<14 chars>", newText: "<19 chars>", expectedOccurrences: 1 },
    workspace: "Loom_Agent_UI"
  },
  {
    type: "approval_required",
    step: 1,
    tool: "replace_in_file",
    input: { path: "src/App.tsx", oldText: "<14 chars>", newText: "<19 chars>", expectedOccurrences: 1 },
    approvalId: "mock-approval-001",
    workspace: "Loom_Agent_UI",
    permissionLevel: "WRITE_CONFIRM",
    riskReason: "文件替换会修改工作区内容，需要人工确认",
    operationPreview: "replace_in_file path=src/App.tsx oldChars=14 newChars=19",
    expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString()
  }
];

export const policyDeniedRun: AgentStreamEvent[] = [
  {
    type: "meta",
    requestId: "mock-request-denied",
    conversationId: "mock-conversation-denied",
    workspace: "Loom_Agent_UI"
  },
  { type: "thought", step: 1, thought: "尝试执行高风险命令。" },
  {
    type: "policy_denied",
    step: 1,
    tool: "run_shell",
    permissionLevel: "HIGH_RISK_DENY",
    riskReason: "命令不在允许列表：rm",
    operationPreview: "rm -rf .",
    observation: "tool_error: policy_denied - 命令不在允许列表：rm"
  },
  { type: "answer", answer: "该命令被策略拒绝，没有执行。" },
  { type: "done", stopReason: "FINAL_ANSWER", stepCount: 1 }
];

export const errorRun: AgentStreamEvent[] = [
  { type: "meta", requestId: "mock-request-error", conversationId: "mock-conversation-error", workspace: "Loom_Agent_UI" },
  { type: "error", code: "invalid_request", message: "question 不能为空" }
];
