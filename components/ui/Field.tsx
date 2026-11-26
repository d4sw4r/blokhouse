import React from "react";
import { cn } from "@/lib/utils";

export interface FieldProps {
    label: React.ReactNode;
    htmlFor: string;
    hint?: React.ReactNode;
    error?: React.ReactNode;
    className?: string;
    children: React.ReactNode;
}

export function Field({ label, htmlFor, hint, error, className, children }: FieldProps) {
    const hintId = hint && !error ? `${htmlFor}-hint` : undefined;
    const errorId = error ? `${htmlFor}-error` : undefined;
    const describedBy = [hintId, errorId].filter(Boolean).join(" ");

    let control = children;
    if (React.isValidElement<Record<string, unknown>>(children) && (describedBy || error)) {
        const existing = children.props["aria-describedby"];
        const merged = [existing, describedBy].filter(Boolean).join(" ");
        control = React.cloneElement(children, {
            ...(merged ? { "aria-describedby": merged } : {}),
            ...(error ? { "aria-invalid": true } : {}),
        });
    }

    return (
        <div className={cn("flex flex-col gap-1.5", className)}>
            <label htmlFor={htmlFor} className="text-sm font-medium text-text">
                {label}
            </label>
            {control}
            {hintId && <p id={hintId} className="text-xs text-muted">{hint}</p>}
            {errorId && (
                <p id={errorId} role="alert" className="text-xs text-danger">
                    {error}
                </p>
            )}
        </div>
    );
}
