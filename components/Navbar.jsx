"use client";
import { signOut, useSession } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import Logo from "@/components/Logo";
import NotificationBell from "@/components/NotificationBell";
import ThemeToggle from "@/components/ThemeToggle";

export default function Navbar() {
    const { data: session } = useSession();
    const router = useRouter();
    if (!session) return null;

    return (
        <header className="bg-white dark:bg-gray-800 shadow-sm sticky top-0 z-50 transition-colors">
            <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
                <div className="flex items-center gap-8">
                    <Link href="/">
                        <Logo />
                    </Link>
                    <nav>
                        <ul className="flex space-x-6">
                            <li>
                                <Link href="/dashboard" className="text-gray-700 dark:text-gray-200 hover:text-brand-primary transition">
                                    Dashboard
                                </Link>
                            </li>
                            <li>
                                <Link href="/items" className="text-gray-700 dark:text-gray-200 hover:text-brand-primary transition">
                                    Items
                                </Link>
                            </li>
                            <li>
                                <Link href="/types" className="text-gray-700 dark:text-gray-200 hover:text-brand-primary transition">
                                    Types
                                </Link>
                            </li>
                            <li>
                                <Link href="/discovert" className="text-gray-700 dark:text-gray-200 hover:text-brand-primary transition">
                                    Discovery
                                </Link>
                            </li>
                        </ul>
                    </nav>
                </div>
                <div className="flex items-center gap-4">
                    <ThemeToggle />
                    {/* Search Trigger */}
                    <button
                        onClick={() => document.dispatchEvent(new CustomEvent("openCommandPalette"))}
                        className="hidden md:flex items-center gap-2 px-3 py-1.5 text-sm text-gray-500 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        <span>Search...</span>
                        <kbd className="hidden lg:inline-block px-1.5 py-0.5 text-xs font-mono bg-white rounded border">
                            ⌘K
                        </kbd>
                    </button>
                    <NotificationBell />
                    <span className="text-gray-600 dark:text-gray-300">
                        Hello, {session.user.name || session.user.email} ({session.user.role})
                    </span>
                    <Button onClick={() => signOut()}>Sign Out</Button>
                    {session.user.role === "ADMIN" && (
                        <Button onClick={() => router.push("/admin")} variant="outline">
                            Admin Area
                        </Button>
                    )}
                </div>
            </div>
        </header>
    );
}
