import React, { forwardRef, InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export const controlClass =
    "w-full rounded-md border border-border-strong bg-surface text-text placeholder:text-muted px-3 text-sm transition-colors duration-150 motion-reduce:transition-none disabled:opacity-50 aria-[invalid=true]:border-danger";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
    ({ className, ...props }, ref) => (
        <input ref={ref} className={cn(controlClass, "h-9 max-sm:min-h-11", className)} {...props} />
    )
);
Input.displayName = "Input";
