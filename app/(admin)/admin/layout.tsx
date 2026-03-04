"use client";

import Logo from "@/components/Logo";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const isActive = (href: string) =>
        pathname?.startsWith(href) ? "text-brand-accent font-semibold" : "hover:text-brand-primary/70";

    return (
        <div className="min-h-screen flex bg-brand-background">
            {/* Sidebar */}
            <aside className="w-64 bg-brand-text text-brand-background p-8 shadow-lg">
                <div className="mb-8">
                    <Link href="/dashboard"><Logo /></Link>

                </div>
                <nav>
                    <ul className="space-y-4">
                        <li>
                            <Link href="/admin">
                                <span className={isActive("/admin")}>Dashboard</span>
                            </Link>
                        </li>
                        <li>
                            <Link href="/admin/users">
                                <span className={isActive("/admin/users")}>Users</span>
                            </Link>
                        </li>
                        <li>
                            <Link href="/admin/api">
                                <span className={isActive("/admin/api")}>API Tokens</span>
                            </Link>
                        </li>
                        <li>
                            <Link href="/admin/settings">
                                <span className={isActive("/admin/settings")}>Settings</span>
                            </Link>
                        </li>
                        <li>
                            <Link href="/admin/custom-fields">
                                <span className={isActive("/admin/custom-fields")}>Custom Fields</span>
                            </Link>
                        </li>
                        <li>
                            <Link href="/admin/audit-logs">
                                <span className={isActive("/admin/audit-logs")}>Audit Logs</span>
                            </Link>
                        </li>
                    </ul>
                </nav>
            </aside >

            {/* Main content area */}
            < main className="flex-1 p-10" >
                {children}
            </main >
        </div >
    );
}
