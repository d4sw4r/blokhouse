"use client";

import React, { forwardRef, ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

// Define the Button's props
interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    className?: string;
}

// Forward the ref while typing the props
const Button = forwardRef < HTMLButtonElement, ButtonProps> (
    ({ className, children, ...props }, ref) => {
        const baseClass =
            "inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2";
        const variantClass = "bg-blue-500 text-white hover:bg-blue-600";
        const sizeClass = "h-10 py-2 px-4";

        return (
            <button
                ref={ref}
                className={cn(baseClass, variantClass, sizeClass, className)}
                {...props}
            >
                {children}
            </button>
        );
    }
);

Button.displayName = "Button";

export { Button };

