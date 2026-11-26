"use client";
import React from "react";
import { Dialog, DialogContent, DialogClose } from "./Dialog";
import { Button } from "./Button";

export interface ConfirmDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    title: string;
    description: string;
    confirmLabel: string;
    tone?: "danger";
    onConfirm: () => void;
}

export function ConfirmDialog({ open, onOpenChange, title, description, confirmLabel, tone, onConfirm }: ConfirmDialogProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                title={title}
                description={description}
                className="max-w-md"
                footer={
                    <>
                        <DialogClose asChild>
                            <Button variant="secondary">Cancel</Button>
                        </DialogClose>
                        <Button
                            variant={tone === "danger" ? "danger" : "primary"}
                            onClick={() => {
                                onConfirm();
                                onOpenChange(false);
                            }}
                        >
                            {confirmLabel}
                        </Button>
                    </>
                }
            />
        </Dialog>
    );
}
