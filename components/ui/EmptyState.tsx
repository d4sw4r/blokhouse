import React from "react";
import type { LucideIcon } from "lucide-react";

export function EmptyState({
    icon: Icon,
    title,
    description,
    action,
}: {
    icon?: LucideIcon;
    title: React.ReactNode;
    description?: React.ReactNode;
    action?: React.ReactNode;
}) {
    return (
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border px-4 py-12 text-center">
            {Icon && <Icon className="size-8 text-muted" aria-hidden="true" />}
            <h3 className="text-sm font-semibold text-text">{title}</h3>
            {description && <p className="max-w-sm text-sm text-muted">{description}</p>}
            {action && <div className="mt-2">{action}</div>}
        </div>
    );
}
