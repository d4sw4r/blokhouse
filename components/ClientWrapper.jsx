"use client";
import { SessionProvider } from "next-auth/react";
import Navbar from "@/components/Navbar";
import CommandPalette from "@/components/CommandPalette";
import { ToastProvider } from "@/components/ToastProvider";

export default function ClientWrapper({ children }) {
    return (
        <SessionProvider>
            <ToastProvider>
                <CommandPalette />
                <Navbar />
                {children}
            </ToastProvider>
        </SessionProvider>
    );
}
