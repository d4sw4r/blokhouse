"use client";

import React, { createContext, useContext, useState, useCallback } from "react";
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
    if (toasts.length === 0) return null;

    return (
        <div className="fixed bottom-4 right-4 max-sm:right-4 z-[100] flex flex-col gap-2">
            {toasts.map((toast) => (
                <ToastItem key={toast.id} toast={toast} onRemove={onRemove} />
            ))}
        </div>
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
            role="alert"
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
