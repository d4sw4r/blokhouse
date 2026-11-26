"use client";
import React from "react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { IconButton } from "./IconButton";
import { isInToastViewport } from "@/components/ToastProvider";

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

export interface DialogContentProps
    extends Omit<React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>, "title"> {
    title: string;
    description?: string;
    footer?: React.ReactNode;
}

export const DialogContent = React.forwardRef<
    React.ComponentRef<typeof DialogPrimitive.Content>,
    DialogContentProps
>(({ title, description, footer, children, className, onInteractOutside, ...props }, ref) => (
    <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-bg/70" />
        <DialogPrimitive.Content
            ref={ref}
            {...(description ? {} : { "aria-describedby": undefined })}
            className={cn(
                "fixed top-1/2 left-1/2 z-50 flex max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 flex-col rounded-[8px] border border-border bg-surface text-text shadow-lg",
                className,
            )}
            onInteractOutside={(e) => {
                onInteractOutside?.(e);
                // A click on a toast (raised from inside this dialog) must not close the dialog.
                if (isInToastViewport(e.target)) e.preventDefault();
            }}
            {...props}
        >
            <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
                <div className="min-w-0">
                    <DialogPrimitive.Title className="text-base font-semibold break-words">{title}</DialogPrimitive.Title>
                    {description ? (
                        <DialogPrimitive.Description className="mt-1 text-sm text-muted break-words">
                            {description}
                        </DialogPrimitive.Description>
                    ) : null}
                </div>
                <DialogPrimitive.Close asChild>
                    <IconButton label="Close" icon={X} className="-mt-1 -mr-2" />
                </DialogPrimitive.Close>
            </div>
            {children ? <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div> : null}
            {footer ? (
                <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border px-5 py-3">
                    {footer}
                </div>
            ) : null}
        </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
));
DialogContent.displayName = "DialogContent";
