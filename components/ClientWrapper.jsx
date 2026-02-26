"use client";
import { SessionProvider } from "next-auth/react";
import Navbar from "@/components/Navbar";
import CommandPalette from "@/components/CommandPalette";

export default function ClientWrapper({ children }) {
    return (
        <SessionProvider>
            <CommandPalette />
            <Navbar />
            {children}
        </SessionProvider>
    );
}
