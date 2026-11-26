"use client";

import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import { CheckCircle2, Info, TriangleAlert, X, XCircle } from "lucide-react";
import { IconButton } from "@/components/ui/IconButton";

export type ToastType = "success" | "error" | "warning" | "info";

export interface Toast {
    id: string;
    type: ToastType;
    title: string;
    message?: string;
    duration?: number;
}

interface ToastContextType {
    toasts: Toast[];
    addToast: (toast: Omit<Toast, "id">) => void;
    removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

const VIEWPORT_ATTR = "data-toast-viewport";

// Radix defers "pointer down outside" to the click, when a toast's close button may already
// have removed the toast from the DOM; remember the pointerdown target so it is still known.
let lastToastPointerTarget: EventTarget | null = null;

/** True when an event target lies inside the toast viewport. Dialogs use it so that clicking
 *  a toast (e.g. its close button) does not count as an outside click that dismisses them. */
export function isInToastViewport(target: EventTarget | null): boolean {
    if (target !== null && target === lastToastPointerTarget) return true;
    return typeof Element !== "undefined" && target instanceof Element && !!target.closest(`[${VIEWPORT_ATTR}]`);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
    const [toasts, setToasts] = useState<Toast[]>([]);

    const removeToast = useCallback((id: string) => {
        setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, []);

    const addToast = useCallback((toast: Omit<Toast, "id">) => {
        const id = Math.random().toString(36).substring(2, 9);
        const newToast = { ...toast, id };
        
        setToasts((prev) => [...prev, newToast]);

        // Auto-remove after duration
        const duration = toast.duration ?? 5000;
        setTimeout(() => {
            removeToast(id);
        }, duration);
    }, [removeToast]);

    return (
        <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
            {children}
            <ToastContainer toasts={toasts} onRemove={removeToast} />
        </ToastContext.Provider>
    );
}

export function useToast() {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error("useToast must be used within a ToastProvider");
    }
    return context;
}

// Toast Container Component
function ToastContainer({ 
    toasts, 
    onRemove 
}: { 
    toasts: Toast[]; 
    onRemove: (id: string) => void;
}) {
    const [mounted, setMounted] = useState(false);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- portal target exists only after mount
    useEffect(() => setMounted(true), []);
    if (!mounted) return null;

    // Always mounted, portalled to <body> and marked aria-live: Radix Dialog's aria-hidden pass
    // (aria-hidden's hideOthers) skips [aria-live] elements, so toasts raised while a dialog is
    // open stay visible to assistive tech; pointer-events-auto overrides the body's
    // pointer-events:none so the close button stays clickable.
    return createPortal(
        <div
            {...{ [VIEWPORT_ATTR]: "" }}
            aria-live="polite"
            aria-relevant="additions text"
            onPointerDownCapture={(e) => {
                lastToastPointerTarget = e.target;
            }}
            className="pointer-events-auto fixed right-4 bottom-4 z-[100] flex flex-col gap-2"
        >
            {toasts.map((toast) => (
                <ToastItem key={toast.id} toast={toast} onRemove={onRemove} />
            ))}
        </div>,
        document.body,
    );
}

// Individual Toast Item
function ToastItem({ 
    toast, 
    onRemove 
}: { 
    toast: Toast; 
    onRemove: (id: string) => void;
}) {
    const icons = {
        success: CheckCircle2,
        error: XCircle,
        warning: TriangleAlert,
        info: Info,
    };
    const Icon = icons[toast.type];

    const iconColors = {
        success: "text-success",
        error: "text-danger",
        warning: "text-warning",
        info: "text-accent",
    };

    return (
        <div
            className="flex w-[min(480px,calc(100vw-2rem))] items-start gap-3 rounded-[8px] border border-border bg-surface px-4 py-3 text-text shadow-lg"
        >
            <div className={`flex-shrink-0 mt-0.5 ${iconColors[toast.type]}`}>
                <Icon className="size-5" aria-hidden="true" />
            </div>
            <div className="flex-1 min-w-0">
                <p className="font-medium text-sm">{toast.title}</p>
                {toast.message && (
                    <p className="text-sm text-muted mt-0.5 break-words">{toast.message}</p>
                )}
            </div>
            <IconButton
                label="Close"
                icon={X}
                onClick={() => onRemove(toast.id)}
                className="-my-1 -mr-2 shrink-0"
            />
        </div>
    );
}
