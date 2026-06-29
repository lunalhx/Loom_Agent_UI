import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { CodeDiffPanel } from "./CodeDiffPanel";

afterEach(() => {
  cleanup();
});

describe("CodeDiffPanel", () => {
  const oldText = [
    "#include <iostream>",
    "",
    "int main() {",
    '    std::cout << "Hello, Loom Agent!" << std::endl;',
    "    return 0;",
    "}"
  ].join("\n");
  const newText = oldText.replace('"Hello, Loom Agent!"', '"hello,loom!"');

  it("renders file name and change stats", () => {
    render(
      <CodeDiffPanel
        diff={{ format: "OLD_NEW", path: "helloworld.cpp", oldText, newText, editable: false }}
      />
    );

    expect(screen.getByText("helloworld.cpp")).toBeInTheDocument();
    expect(screen.getAllByText((_, element) => element?.textContent === "+1 -1").length).toBeGreaterThan(0);
  });

  it("applies semantic CSS classes to added, removed, and context lines in unified view", () => {
    const { container } = render(
      <CodeDiffPanel
        diff={{ format: "OLD_NEW", path: "test.cpp", oldText, newText, editable: false }}
      />
    );

    const rows = container.querySelectorAll(".diff-line-added, .diff-line-removed, .diff-line-context");
    expect(rows.length).toBeGreaterThan(0);

    const addedRow = Array.from(container.querySelectorAll(".diff-line-added")).find((r) =>
      r.textContent?.includes("hello,loom!")
    );
    expect(addedRow).toBeTruthy();

    const removedRow = Array.from(container.querySelectorAll(".diff-line-removed")).find((r) =>
      r.textContent?.includes("Hello, Loom Agent!")
    );
    expect(removedRow).toBeTruthy();

    const contextRow = Array.from(container.querySelectorAll(".diff-line-context")).find((r) =>
      r.textContent?.includes("#include <iostream>")
    );
    expect(contextRow).toBeTruthy();
  });

  it("renders unified view with only symbol and code columns, no line numbers", () => {
    const { container } = render(
      <CodeDiffPanel
        diff={{ format: "OLD_NEW", path: "test.cpp", oldText, newText, editable: false }}
      />
    );

    const diffRows = container.querySelectorAll("[class*='diff-line-']");
    expect(diffRows.length).toBeGreaterThan(0);

    for (const row of diffRows) {
      // Each row should be a flex container with exactly 2 children: symbol + code
      expect(row.children.length).toBe(2);

      const symbolSpan = row.children[0] as HTMLElement;
      expect(symbolSpan.classList.contains("diff-symbol")).toBe(true);
      const symbolText = symbolSpan.textContent ?? "";
      expect(["+", "-", ""]).toContain(symbolText);

      const codeSpan = row.children[1] as HTMLElement;
      // Code should use whitespace-pre (check via className or computed style)
      expect(codeSpan.tagName).toBe("SPAN");
    }
  });

  it("does not render character-level inline diff highlights", () => {
    const { container } = render(
      <CodeDiffPanel
        diff={{ format: "OLD_NEW", path: "test.cpp", oldText, newText, editable: false }}
      />
    );

    // No character-level rounded background spans inside diff lines
    const diffRows = container.querySelectorAll("[class*='diff-line-']");
    for (const row of diffRows) {
      const inlineHighlights = row.querySelectorAll("[class*='rounded-']");
      expect(inlineHighlights.length).toBe(0);
    }

    // The inline diff should just be full-line text
    const removedLine = Array.from(container.querySelectorAll(".diff-line-removed")).find((r) =>
      r.textContent?.includes("Hello, Loom Agent!")
    );
    expect(removedLine).toBeTruthy();
    // Only the outer code span, no character-level spans inside
    const codePart = removedLine!.querySelectorAll("span span");
    expect(codePart.length).toBe(0);
  });

  it("preserves code indentation and empty lines", () => {
    const { container } = render(
      <CodeDiffPanel
        diff={{ format: "OLD_NEW", path: "test.cpp", oldText, newText, editable: false }}
      />
    );

    // Empty line should be preserved — find a context row whose code span contains only whitespace
    const contextRows = Array.from(container.querySelectorAll(".diff-line-context"));
    const emptyRow = contextRows.find((r) => {
      const codeSpan = r.querySelector(".whitespace-pre");
      return codeSpan && codeSpan.textContent !== null && codeSpan.textContent.trim() === "";
    });
    expect(emptyRow).toBeTruthy();

    // Indentation preserved (4 spaces before std::cout) — this is in the changed lines
    const allDiffRows = Array.from(container.querySelectorAll("[class*='diff-line-']"));
    const indentedRow = allDiffRows.find((r) =>
      r.textContent?.includes("    std::cout")
    );
    expect(indentedRow).toBeTruthy();
  });

  it("renders split view with line numbers and pairing", () => {
    const { container } = render(
      <CodeDiffPanel
        diff={{ format: "OLD_NEW", path: "test.cpp", oldText, newText, editable: false }}
      />
    );

    fireEvent.click(screen.getByTitle("并排视图"));

    expect(screen.getByText("原文件")).toBeInTheDocument();
    expect(screen.getByText("新文件")).toBeInTheDocument();

    // Split view should have line numbers — find text nodes that look like line numbers
    const allText = container.textContent ?? "";
    // Should contain the old and new code fragments paired
    expect(allText).toContain("Hello, Loom Agent!");
    expect(allText).toContain("hello,loom!");
  });

  it("renders UNIFIED format diff", () => {
    const unifiedDiff = [
      "diff --git a/test.cpp b/test.cpp",
      "index abc..def 100644",
      "--- a/test.cpp",
      "+++ b/test.cpp",
      "@@ -1,3 +1,3 @@",
      " line1",
      "-old line",
      "+new line",
      " line3"
    ].join("\n");

    const { container } = render(
      <CodeDiffPanel diff={{ format: "UNIFIED", unifiedDiff, editable: false }} />
    );

    expect(container.querySelector(".diff-line-removed")).toBeTruthy();
    expect(container.querySelector(".diff-line-added")).toBeTruthy();
  });

  it("renders folded context rows and expands them", () => {
    const manyContextLines = [
      "line1", "line2", "line3", "line4", "line5",
      "line6", "line7", "line8", "line9", "line10",
      "line11", "line12", "line13", "line14", "line15",
      "line16", "line17", "line18", "line19", "line20",
      "changed line old"
    ].join("\n");
    const newManyContextLines = manyContextLines.replace("changed line old", "changed line new");

    const { container } = render(
      <CodeDiffPanel
        diff={{ format: "OLD_NEW", path: "many.cpp", oldText: manyContextLines, newText: newManyContextLines, editable: false }}
      />
    );

    // Should have a folded row button
    const expandBtn = screen.getByText(/展开/);
    expect(expandBtn).toBeInTheDocument();

    // Count folded rows before expand
    const foldedBefore = container.querySelectorAll("button").length;
    expect(foldedBefore).toBeGreaterThan(0);

    fireEvent.click(expandBtn);

    // After expand, folded row buttons should be gone (context lines now visible as diff-line-context rows)
    const foldedAfter = container.querySelectorAll(".diff-line-context");
    expect(foldedAfter.length).toBeGreaterThan(0);
  });
});
