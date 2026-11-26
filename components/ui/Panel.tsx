import React from "react";
import { cn } from "@/lib/utils";

export interface PanelProps extends Omit<React.HTMLAttributes<HTMLElement>, "title"> {
    title?: React.ReactNode;
    actions?: React.ReactNode;
    padded?: boolean;
}

export function Panel({ title, actions, padded = true, className, children, ...props }: PanelProps) {
    return (
        <section className={cn("min-w-0 rounded-lg border border-border bg-surface", className)} {...props}>
            {(title || actions) && (
                <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
                    {title && <h2 className="min-w-0 truncate text-sm font-semibold text-text">{title}</h2>}
                    {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
                </header>
            )}
            <div className={cn(padded && "p-4")}>{children}</div>
        </section>
    );
}
