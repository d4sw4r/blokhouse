"use client";
import { SessionProvider } from "next-auth/react";
import AppShell from "@/components/shell/AppShell";
import CommandPalette from "@/components/CommandPalette";
import { ToastProvider } from "@/components/ToastProvider";

export default function ClientWrapper({ children }) {
    return (
        <SessionProvider>
            <ToastProvider>
                <CommandPalette />
                <AppShell>{children}</AppShell>
            </ToastProvider>
        </SessionProvider>
    );
}
