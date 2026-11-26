"use client";
import React from "react";
import { Tooltip as TooltipPrimitive } from "radix-ui";

export function Tooltip({ content, children }: { content: React.ReactNode; children: React.ReactElement }) {
    return (
        <TooltipPrimitive.Provider delayDuration={300}>
            <TooltipPrimitive.Root>
                <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
                <TooltipPrimitive.Portal>
                    <TooltipPrimitive.Content
                        sideOffset={6}
                        className="z-50 max-w-xs rounded-md border border-border bg-surface-2 px-2 py-1 text-xs text-text shadow-lg"
                    >
                        {content}
                    </TooltipPrimitive.Content>
                </TooltipPrimitive.Portal>
            </TooltipPrimitive.Root>
        </TooltipPrimitive.Provider>
    );
}
