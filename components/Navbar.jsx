"use client";

import { signOut, useSession } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import Logo from "@/components/Logo";

export default function Navbar() {
    const { data: session } = useSession();
    const router = useRouter();


    if (!session) {
        return null;
    }

    return (
        <header className="bg-white shadow-md">
            <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
                {/* Left side: Logo and Navigation Links */}
                <div className="flex items-center gap-8">
                    <Link href="/">
                        <Logo />
                    </Link>
                    <nav>
                        <ul className="flex gap-6">
                            <li>
                                <Link href="/dashboard">
                                    <span className="text-gray-700 hover:text-brandRoof cursor-pointer">Dashboard</span>
                                </Link>
                            </li>
                            <li>
                                <Link href="/items">
                                    <span className="text-gray-700 hover:text-brandRoof cursor-pointer">Items</span>
                                </Link>
                            </li>
                            <li>
                                <Link href="/types">
                                    <span className="text-gray-700 hover:text-brandRoof cursor-pointer">Types</span>
                                </Link>
                            </li>
                            <li>
                                <Link href="/discovert">
                                    <span className="text-gray-700 hover:text-brandRoof cursor-pointer">Discovery</span>
                                </Link>
                            </li>
                        </ul>
                    </nav>
                </div>
                {/* Right side: User Info and Actions */}
                <div className="flex items-center gap-4">
                    {session ? (
                        <>
                            <span className="text-gray-600">
                                Hello, {session.user.name || session.user.email}
                            </span>
                            <Button onClick={() => signOut()}>Sign Out</Button>
                            <Button onClick={() => router.push("/admin")} variant="outline">
                                Admin Area
                            </Button>
                        </>
                    ) : (
                        <Link href="/signin">
                            <Button>Sign In</Button>
                        </Link>
                    )}
                </div>
            </div>
        </header>
    );
}
