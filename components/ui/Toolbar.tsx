import React from "react";
import { cn } from "@/lib/utils";

export function Toolbar({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
    return <div role="toolbar" className={cn("mb-4 flex flex-wrap items-center gap-2", className)} {...props} />;
}
