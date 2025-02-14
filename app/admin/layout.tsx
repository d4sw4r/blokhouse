"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const isActive = (href: string) =>
        pathname?.startsWith(href) ? "text-brandRoof font-semibold" : "hover:text-gray-300";

    return (
        <div className="min-h-screen flex bg-gray-50">
            {/* Sidebar */}
            <aside className="w-64 bg-gray-900 text-white p-8 shadow-lg">
                <div className="mb-8">
                    <Link href="/">
                        {/* Refreshed Logo – replace /logo-new.svg with your actual logo */}
                        <Image src="/logo.svg" alt="Blokhouse" className="h-10 mx-auto" width={30} height={30} />
                        <h1 className="mt-2 text-center text-2xl font-bold tracking-wide">Blokhouse</h1>
                    </Link>
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

                    </ul>
                </nav>
            </aside>

            {/* Main content area */}
            <main className="flex-1 p-10">
                {children}
            </main>
        </div>
    );
}
