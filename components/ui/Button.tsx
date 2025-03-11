"use client";
import React, { forwardRef, ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    className?: string;
    variant?: "destructive" | "outline";
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, children, variant, ...props }, ref) => {
        let variantClass = "bg-brand-primary text-white hover:bg-brand-accent";
        if (variant === "outline") {
            variantClass = "border border-brand-primary text-brand-primary hover:bg-brand-primary hover:text-white";
        } else if (variant === "destructive") {
            variantClass = "bg-red-500 text-white hover:bg-red-600";
        }
        const baseClass = "inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus:outline-hidden focus:ring-2 focus:ring-offset-2";
        const sizeClass = "h-10 py-2 px-4";

        return (
            <button ref={ref} className={cn(baseClass, variantClass, sizeClass, className)} {...props}>
                {children}
            </button>
        );
    }
);
Button.displayName = "Button";
export { Button };
