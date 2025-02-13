// app/admin/layout.tsx
"use client"; // This is a client component because it uses Next/link for navigation

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();

    // Optional: highlight active link
    const isActive = (href: string) => pathname?.startsWith(href);

    return (
        <div className="min-h-screen flex">
            {/* Sidebar */}
            <aside className="w-64 bg-gray-800 text-white p-6">
                <h2 className="text-2xl font-bold mb-6">Admin Area</h2>
                <nav>
                    <ul>
                        <li className="mb-4">
                            <Link href="/admin/users">
                                <span className={isActive("/admin/users") ? "text-brandRoof" : "hover:text-gray-300"}>
                                    Users
                                </span>
                            </Link>
                        </li>
                        <li className="mb-4">
                            <Link href="/admin/api">
                                <span className={isActive("/admin/api") ? "text-brandRoof" : "hover:text-gray-300"}>
                                    API
                                </span>
                            </Link>
                        </li>
                        <li className="mb-4">
                            <Link href="/admin/settings">
                                <span className={isActive("/admin/settings") ? "text-brandRoof" : "hover:text-gray-300"}>
                                    Settings
                                </span>
                            </Link>
                        </li>
                        <li className="mb-4">
                            <Link href="/ansible">
                                <span className={isActive("/ansible") ? "text-brandRoof" : "hover:text-gray-300"}>
                                    Ansible
                                </span>
                            </Link>
                        </li>
                    </ul>
                </nav>
            </aside>

            {/* Main content area */}
            <main className="flex-1 p-6 bg-gray-100">{children}</main>
        </div>
    );
}
