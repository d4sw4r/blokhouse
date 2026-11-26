"use client";
import React from "react";
import { Switch as SwitchPrimitive } from "radix-ui";
import { cn } from "@/lib/utils";

export const Switch = React.forwardRef<
    React.ComponentRef<typeof SwitchPrimitive.Root>,
    React.ComponentPropsWithoutRef<typeof SwitchPrimitive.Root>
>(({ className, ...props }, ref) => (
    <SwitchPrimitive.Root
        ref={ref}
        className={cn(
            "relative inline-flex before:absolute before:left-1/2 before:top-1/2 before:size-11 before:-translate-x-1/2 before:-translate-y-1/2 before:content-[''] sm:before:hidden h-5 w-9 shrink-0 items-center rounded-full border border-border-strong bg-surface-2 transition-colors duration-150 motion-reduce:transition-none data-[state=checked]:border-accent data-[state=checked]:bg-accent disabled:opacity-50 disabled:pointer-events-none",
            className,
        )}
        {...props}
    >
        <SwitchPrimitive.Thumb className="block size-3.5 translate-x-0.5 rounded-full bg-text transition-transform duration-150 motion-reduce:transition-none data-[state=checked]:translate-x-[18px] data-[state=checked]:bg-accent-fg" />
    </SwitchPrimitive.Root>
));
Switch.displayName = "Switch";
