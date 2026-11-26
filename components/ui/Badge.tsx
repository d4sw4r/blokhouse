import React from "react";
import { cn } from "@/lib/utils";

export type BadgeTone = "neutral" | "accent" | "success" | "warning" | "danger";

const tones: Record<BadgeTone, string> = {
    // Tint 10% (verified >= 4.5:1 in __tests__/ui/contrast.test.js). Success and warning
    // keep text-text because their light-theme tone colours fall short on the tint.
    neutral: "bg-neutral/10 text-text border-neutral/40",
    accent: "bg-accent/10 text-accent border-accent/40",
    success: "bg-success/10 text-text border-success/40",
    warning: "bg-warning/10 text-text border-warning/40",
    danger: "bg-danger/10 text-danger border-danger/40",
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
