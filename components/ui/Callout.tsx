import React from "react";
import { CircleAlert, CircleCheck, Info, TriangleAlert, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type CalloutTone = "danger" | "success" | "warning" | "accent";

// Tint 10% with the tone on the icon and left border only; text stays text-text (and
// text-muted for secondary lines) so it keeps >= 4.5:1 on every surface in both themes.
// Keep CALLOUT_TINT in __tests__/ui/contrast.test.js in sync.
const tones: Record<CalloutTone, { box: string; icon: string; Icon: LucideIcon }> = {
    danger: { box: "border-danger/40 border-l-danger bg-danger/10", icon: "text-danger", Icon: CircleAlert },
    success: { box: "border-success/40 border-l-success bg-success/10", icon: "text-success", Icon: CircleCheck },
    warning: { box: "border-warning/40 border-l-warning bg-warning/10", icon: "text-warning", Icon: TriangleAlert },
    accent: { box: "border-accent/40 border-l-accent bg-accent/10", icon: "text-accent", Icon: Info },
};

export interface CalloutProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
    tone: CalloutTone;
    title?: React.ReactNode;
    /** Override the default tone icon; pass `null` for none. */
    icon?: LucideIcon | null;
}

export function Callout({ tone, title, icon, className, children, ...props }: CalloutProps) {
    const t = tones[tone];
    const Icon = icon === undefined ? t.Icon : icon;
    return (
        <div
            className={cn("flex min-w-0 items-start gap-3 rounded-md border border-l-4 p-3 text-sm text-text", t.box, className)}
            {...props}
        >
            {Icon && <Icon className={cn("mt-0.5 size-4 shrink-0", t.icon)} aria-hidden="true" />}
            <div className="min-w-0 flex-1 break-words">
                {title && <div className="font-semibold text-text">{title}</div>}
                {children}
            </div>
        </div>
    );
}
