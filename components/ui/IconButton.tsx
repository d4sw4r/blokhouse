"use client";
import React, { forwardRef } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    label: string;
    icon: LucideIcon;
    /** md: 36 px (default); sm: 32 px. Both grow to a 44 px target below 640 px. */
    size?: "sm" | "md";
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
    ({ label, icon: Icon, size = "md", className, type = "button", ...props }, ref) => (
        <button
            ref={ref}
            type={type}
            aria-label={label}
            title={label}
            className={cn(
                "inline-flex items-center justify-center rounded-md text-muted transition-colors duration-150 motion-reduce:transition-none hover:bg-surface-2 hover:text-text max-sm:size-11 disabled:opacity-50 disabled:pointer-events-none",
                size === "sm" ? "size-8" : "size-9",
                className,
            )}
            {...props}
        >
            <Icon className="size-4" aria-hidden="true" />
        </button>
    )
);
IconButton.displayName = "IconButton";
