// components/ClientWrapper.jsx
"use client";

import { SessionProvider } from "next-auth/react";


export default function ClientWrapper({ children }) {
    return (
        <SessionProvider>
            {children}
        </SessionProvider>
    );
}
