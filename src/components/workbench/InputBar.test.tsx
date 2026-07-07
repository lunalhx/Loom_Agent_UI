import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAgentStore } from "@/store/agentStore";
import { InputBar } from "./InputBar";

describe("InputBar state buttons", () => {
  beforeEach(() => {
    useAgentStore.setState({
      prompt: "",
      selectedLocalFile: undefined,
      status: "IDLE",
      selectedModel: "deepseek-v4-flash",
      allowedModels: ["deepseek-v4-flash", "deepseek-v4-pro"],
      runHistory: [],
      sessions: [],
      recoverable: false,
      streams: {}
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("shows a 恢复 (resume) button when the run is disconnected and recoverable", () => {
    useAgentStore.setState({ status: "DISCONNECTED", recoverable: true });
    const resume = vi.fn().mockResolvedValue(undefined);
    useAgentStore.setState({ resumeDisconnectedRun: resume });
    render(<InputBar />);

    const btn = screen.getByRole("button", { name: "恢复运行" });
    fireEvent.click(btn);
    expect(resume).toHaveBeenCalledOnce();
  });

  it("disables the send button when there is no prompt and no recoverable action", () => {
    render(<InputBar />);

    const sendButton = screen.getByRole("button", { name: "发送" });
    expect(sendButton).toBeDisabled();
  });

  it("shows a 可恢复 chip when the most recent error was recoverable but the run is no longer disconnected", () => {
    useAgentStore.setState({ status: "ERROR", recoverable: true, error: "transient" });
    render(<InputBar />);

    expect(screen.getByText("可恢复")).toBeInTheDocument();
  });
});
