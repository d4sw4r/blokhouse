import React from "react";
import { cn } from "@/lib/utils";

export type BadgeTone = "neutral" | "accent" | "success" | "warning" | "danger";

const tones: Record<BadgeTone, string> = {
    neutral: "bg-neutral/15 text-text border-neutral/40",
    accent: "bg-accent/15 text-accent border-accent/40",
    success: "bg-success/15 text-success border-success/40",
    warning: "bg-warning/15 text-warning border-warning/40",
    danger: "bg-danger/15 text-danger border-danger/40",
};

export function Badge({
    tone = "neutral",
    className,
    ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: BadgeTone }) {
    return (
        <span
            className={cn(
                "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium whitespace-nowrap",
                tones[tone],
                className,
            )}
            {...props}
        />
    );
}
