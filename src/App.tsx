import { Flow } from "@/components/workbench/Flow";
import { HitlPermissionBar } from "@/components/workbench/HitlPermissionBar";
import { InputBar } from "@/components/workbench/InputBar";
import { RightRail } from "@/components/workbench/RightRail";
import { Sidebar } from "@/components/workbench/Sidebar";
import { TopBar } from "@/components/workbench/TopBar";

export default function App() {
  return (
    <div className="flex h-screen min-h-[720px] flex-col overflow-hidden bg-background text-foreground">
      <TopBar />
      <div className="flex min-h-0 flex-1">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <HitlPermissionBar />
          <Flow />
          <InputBar />
        </div>
        <RightRail />
      </div>
    </div>
  );
}
