"use client";
import React, { forwardRef, ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    className?: string;
    variant?: "destructive" | "outline";
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, children, variant, ...props }, ref) => {
        let variantClass = "bg-brandPrimary text-white hover:bg-brandAccent";
        if (variant === "outline") {
            variantClass = "border border-brandPrimary text-brandPrimary hover:bg-brandPrimary hover:text-white";
        } else if (variant === "destructive") {
            variantClass = "bg-red-500 text-white hover:bg-red-600";
        }
        const baseClass = "inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2";
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
