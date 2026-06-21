import * as React from "react";
import { cn } from "@/lib/utils";

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => (
    <select
      ref={ref}
      className={cn(
        "focus-ring h-8 appearance-none rounded-full border border-border bg-[#171a1d] px-8 pl-9 font-mono text-sm text-muted-foreground shadow-insetline transition hover:border-border/80 hover:text-foreground",
        className
      )}
      {...props}
    >
      {children}
    </select>
  )
);
Select.displayName = "Select";
