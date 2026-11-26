import React from "react";
import { cn } from "@/lib/utils";

export type BadgeTone = "neutral" | "accent" | "success" | "warning" | "danger";

const tones: Record<BadgeTone, string> = {
    // Tint 10% with text-text for every tone (verified >= 4.5:1 on bg, surface and surface-2
    // in both themes in __tests__/ui/contrast.test.js); the tone shows in the tint and border.
    neutral: "bg-neutral/10 text-text border-neutral/40",
    accent: "bg-accent/10 text-text border-accent/60",
    success: "bg-success/10 text-text border-success/60",
    warning: "bg-warning/10 text-text border-warning/60",
    danger: "bg-danger/10 text-text border-danger/60",
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
