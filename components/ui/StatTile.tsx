import React from "react";
import { cn } from "@/lib/utils";

const tones = {
    success: "text-success",
    warning: "text-warning",
    danger: "text-danger",
    accent: "text-accent",
    neutral: "text-text",
} as const;

export function StatTile({
    label,
    value,
    tone = "neutral",
    className,
}: {
    label: string;
    value: React.ReactNode;
    tone?: keyof typeof tones;
    className?: string;
}) {
    return (
        <div className={cn("min-w-0 rounded-lg border border-border bg-surface p-4", className)}>
            <div className="text-xs font-medium text-muted">{label}</div>
            <div className={cn("mt-1 font-mono text-2xl font-semibold tabular-nums", tones[tone])}>{value}</div>
        </div>
    );
}
