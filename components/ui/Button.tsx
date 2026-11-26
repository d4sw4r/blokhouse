"use client";
import React, { forwardRef, ButtonHTMLAttributes } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    className?: string;
    variant?: "primary" | "secondary" | "ghost" | "danger";
    size?: "sm" | "md";
    loading?: boolean;
}

const variants = {
    primary: "bg-accent text-accent-fg hover:bg-accent/90",
    secondary: "bg-surface text-text border border-border-strong hover:bg-surface-2",
    ghost: "bg-transparent text-text hover:bg-surface-2",
    danger: "bg-danger text-bg hover:bg-danger/90",
} as const;

const sizes = {
    sm: "h-8 px-3 text-xs",
    md: "h-9 px-4 text-sm",
} as const;

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, children, variant = "primary", size = "md", loading = false, disabled, ...props }, ref) => {
        return (
            <button
                ref={ref}
                disabled={disabled || loading}
                aria-busy={loading || undefined}
                className={cn(
                    "inline-flex items-center justify-center gap-2 rounded-md font-medium whitespace-nowrap transition-colors duration-150 motion-reduce:transition-none max-sm:min-h-11 disabled:opacity-50 disabled:pointer-events-none",
                    variants[variant],
                    sizes[size],
                    className,
                )}
                {...props}
            >
                {loading && <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />}
                {children}
            </button>
        );
    }
);
Button.displayName = "Button";
export { Button };
export default Button;
