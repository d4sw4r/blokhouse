"use client";
import TopBar from "./TopBar";

export default function AppShell({ children }: { children: React.ReactNode }) {
    return (
        <div className="min-h-screen bg-bg text-text">
            <TopBar />
            <main className="mx-auto w-full max-w-[1440px] px-4 pt-6 sm:px-7">{children}</main>
        </div>
    );
}
