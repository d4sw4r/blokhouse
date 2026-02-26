"use client";
import React, { forwardRef, ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    className?: string;
    variant?: "destructive" | "outline";
    size?: "sm" | "md" | "lg";
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, children, variant, size = "md", ...props }, ref) => {
        let variantClass = "bg-brand-primary text-white hover:bg-brand-accent";
        if (variant === "outline") {
            variantClass = "border border-brand-primary text-brand-primary hover:bg-brand-primary hover:text-white";
        } else if (variant === "destructive") {
            variantClass = "bg-red-500 text-white hover:bg-red-600";
        }
        const baseClass = "inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus:outline-hidden focus:ring-2 focus:ring-offset-2";
        
        const sizeClasses = {
            sm: "h-8 py-1.5 px-3 text-xs",
            md: "h-10 py-2 px-4",
            lg: "h-12 py-3 px-6 text-base",
        };
        const sizeClass = sizeClasses[size];

        return (
            <button ref={ref} className={cn(baseClass, variantClass, sizeClass, className)} {...props}>
                {children}
            </button>
        );
    }
);
Button.displayName = "Button";
export { Button };
