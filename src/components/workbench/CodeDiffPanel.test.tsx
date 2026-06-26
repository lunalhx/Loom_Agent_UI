import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { CodeDiffPanel } from "./CodeDiffPanel";

afterEach(() => {
  cleanup();
});

describe("CodeDiffPanel", () => {
  it("renders a minimal line diff with inline highlights and split view", () => {
    const oldText = [
      "#include <iostream>",
      "",
      "int main() {",
      "    std::cout << \"Hello, Loom Agent!\" << std::endl;",
      "    return 0;",
      "}"
    ].join("\n");
    const newText = oldText.replace("\"Hello, Loom Agent!\"", "\"hello,loom!\"");

    const { container } = render(
      <CodeDiffPanel
        diff={{
          format: "OLD_NEW",
          path: "helloworld.cpp",
          oldText,
          newText,
          editable: false
        }}
      />
    );

    const rowWithText = (text: string) =>
      Array.from(container.querySelectorAll(".grid")).find((row) => row.textContent?.includes(text));

    expect(screen.getAllByText((_, element) => element?.textContent === "+1 -1").length).toBeGreaterThan(0);
    expect(rowWithText("#include <iostream>")).toHaveClass("text-white/58");
    expect(rowWithText("Hello, Loom Agent!")).toHaveClass("bg-red-500/14");
    expect(rowWithText("hello,loom!")).toHaveClass("bg-emerald-500/12");

    fireEvent.click(screen.getByTitle("并排视图"));

    expect(screen.getByText("原文件")).toBeInTheDocument();
    expect(screen.getByText("新文件")).toBeInTheDocument();
    expect(rowWithText("Loom Agent")).toBeTruthy();
    expect(rowWithText("hello,loom")).toBeTruthy();
  });
});
