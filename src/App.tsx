import { useEffect, useState } from "react";
import { Flow } from "@/components/workbench/Flow";
import { InputBar } from "@/components/workbench/InputBar";
import { RightRail } from "@/components/workbench/RightRail";
import { Sidebar } from "@/components/workbench/Sidebar";
import { TopBar } from "@/components/workbench/TopBar";

export default function App() {
  const [leftPanelOpen, setLeftPanelOpen] = useState(() => window.innerWidth >= 1180);
  const [rightPanelOpen, setRightPanelOpen] = useState(() => window.innerWidth >= 1180);

  const toggleLeftPanel = () => {
    setLeftPanelOpen((open) => {
      const next = !open;
      if (next && window.innerWidth < 960) setRightPanelOpen(false);
      return next;
    });
  };

  const toggleRightPanel = () => {
    setRightPanelOpen((open) => {
      const next = !open;
      if (next && window.innerWidth < 960) setLeftPanelOpen(false);
      return next;
    });
  };

  useEffect(() => {
    let wideLayout = window.innerWidth >= 1180;
    setLeftPanelOpen(wideLayout);
    setRightPanelOpen(wideLayout);

    const handleResize = () => {
      const nextWideLayout = window.innerWidth >= 1180;
      if (nextWideLayout === wideLayout) return;
      wideLayout = nextWideLayout;
      setLeftPanelOpen(nextWideLayout);
      setRightPanelOpen(nextWideLayout);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey)) return;
      if (event.key === "1") {
        event.preventDefault();
        toggleLeftPanel();
      }
      if (event.key === "2") {
        event.preventDefault();
        toggleRightPanel();
      }
    };
    window.addEventListener("resize", handleResize);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  return (
    <div className="flex h-screen min-h-[720px] flex-col overflow-hidden bg-background text-foreground">
      <TopBar
        leftPanelOpen={leftPanelOpen}
        rightPanelOpen={rightPanelOpen}
        onToggleLeftPanel={toggleLeftPanel}
        onToggleRightPanel={toggleRightPanel}
      />
      <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden">
        <Sidebar open={leftPanelOpen} />
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <Flow />
          <InputBar />
        </div>
        <RightRail open={rightPanelOpen} />
      </div>
    </div>
  );
}
