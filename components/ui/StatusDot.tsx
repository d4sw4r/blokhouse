import React from "react";
import { cn } from "@/lib/utils";
import { statusTone } from "@/lib/ui/status";
import { toneBgClass } from "@/lib/ui/tone";

export function StatusDot({ status, size = "sm", className }: { status: string; size?: "sm" | "xs"; className?: string }) {
    const { tone, label } = statusTone(status);
    return (
        <span className={cn("inline-flex items-center", size === "xs" ? "gap-1 text-xs text-muted" : "gap-2 text-sm text-text", className)}>
            <span className={cn("size-2 shrink-0 rounded-full", toneBgClass(tone))} aria-hidden="true" />
            {label}
        </span>
    );
}
