"use client";
import React from "react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { IconButton } from "./IconButton";

export interface SheetProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    side?: "left" | "right";
    title: string;
    children: React.ReactNode;
}

export function Sheet({ open, onOpenChange, side = "left", title, children }: SheetProps) {
    return (
        <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
            <DialogPrimitive.Portal>
                <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-bg/70" />
                <DialogPrimitive.Content
                    aria-describedby={undefined}
                    className={cn(
                        "fixed inset-y-0 z-50 flex h-dvh w-[min(320px,85vw)] flex-col border-border bg-surface text-text shadow-lg",
                        side === "left" ? "left-0 border-r" : "right-0 border-l",
                    )}
                >
                    <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
                        <DialogPrimitive.Title className="text-base font-semibold">{title}</DialogPrimitive.Title>
                        <DialogPrimitive.Close asChild>
                            <IconButton label="Close" icon={X} />
                        </DialogPrimitive.Close>
                    </div>
                    <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
                </DialogPrimitive.Content>
            </DialogPrimitive.Portal>
        </DialogPrimitive.Root>
    );
}
