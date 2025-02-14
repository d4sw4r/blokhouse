"use client";
import { SessionProvider } from "next-auth/react";
import Navbar from "@/components/Navbar";

export default function ClientWrapper({ children }) {
    return (
        <SessionProvider>
            <Navbar />
            {children}
        </SessionProvider>
    );
}
