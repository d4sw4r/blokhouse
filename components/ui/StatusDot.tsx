import React from "react";
import { cn } from "@/lib/utils";
import { statusTone } from "@/lib/ui/status";

const dot = { success: "bg-success", warning: "bg-warning", neutral: "bg-neutral" } as const;

export function StatusDot({ status, className }: { status: string; className?: string }) {
    const { tone, label } = statusTone(status);
    return (
        <span className={cn("inline-flex items-center gap-2 text-sm text-text", className)}>
            <span className={cn("size-2 shrink-0 rounded-full", dot[tone])} aria-hidden="true" />
            {label}
        </span>
    );
}
