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
    return (
        <div className={cn("flex flex-col gap-1.5", className)}>
            <label htmlFor={htmlFor} className="text-sm font-medium text-text">
                {label}
            </label>
            {children}
            {hint && !error && <p id={`${htmlFor}-hint`} className="text-xs text-muted">{hint}</p>}
            {error && (
                <p id={`${htmlFor}-error`} role="alert" className="text-xs text-danger">
                    {error}
                </p>
            )}
        </div>
    );
}
