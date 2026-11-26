"use client";
import React from "react";
import { Checkbox as CheckboxPrimitive } from "radix-ui";
import { Check, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

export const Checkbox = React.forwardRef<
    React.ComponentRef<typeof CheckboxPrimitive.Root>,
    React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(({ className, ...props }, ref) => (
    <CheckboxPrimitive.Root
        ref={ref}
        className={cn(
            "peer inline-flex size-4 shrink-0 items-center justify-center rounded-sm border border-border-strong bg-surface text-accent-fg transition-colors duration-150 motion-reduce:transition-none data-[state=checked]:border-accent data-[state=checked]:bg-accent data-[state=indeterminate]:border-accent data-[state=indeterminate]:bg-accent disabled:opacity-50 disabled:pointer-events-none",
            className,
        )}
        {...props}
    >
        <CheckboxPrimitive.Indicator className="inline-flex">
            {props.checked === "indeterminate" ? (
                <Minus className="size-3" aria-hidden="true" />
            ) : (
                <Check className="size-3" aria-hidden="true" />
            )}
        </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
));
Checkbox.displayName = "Checkbox";
