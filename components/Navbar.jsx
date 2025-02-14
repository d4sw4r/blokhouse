"use client";
import { signOut, useSession } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import Logo from "@/components/Logo";

export default function Navbar() {
    const { data: session } = useSession();
    const router = useRouter();
    if (!session) return null;

    return (
        <header className="bg-white shadow sticky top-0 z-50">
            <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
                <div className="flex items-center gap-8">
                    <Link href="/">
                        <Logo />
                    </Link>
                    <nav>
                        <ul className="flex space-x-6">
                            <li>
                                <Link href="/dashboard" className="text-gray-700 hover:text-brandPrimary transition">
                                    Dashboard
                                </Link>
                            </li>
                            <li>
                                <Link href="/items" className="text-gray-700 hover:text-brandPrimary transition">
                                    Items
                                </Link>
                            </li>
                            <li>
                                <Link href="/types" className="text-gray-700 hover:text-brandPrimary transition">
                                    Types
                                </Link>
                            </li>
                            <li>
                                <Link href="/discovert" className="text-gray-700 hover:text-brandPrimary transition">
                                    Discovery
                                </Link>
                            </li>
                        </ul>
                    </nav>
                </div>
                <div className="flex items-center gap-4">
                    <span className="text-gray-600">Hello, {session.user.name || session.user.email}</span>
                    <Button onClick={() => signOut()}>Sign Out</Button>
                    <Button onClick={() => router.push("/admin")} variant="outline">
                        Admin Area
                    </Button>
                </div>
            </div>
        </header>
    );
}
