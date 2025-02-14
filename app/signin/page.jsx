'use client';

import { signIn } from "next-auth/react";
import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";

export default function SignInPage() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");
        const result = await signIn("credentials", {
            email,
            password,
            callbackUrl: "/dashboard",
        });
        if (result?.error) {
            setError("Invalid credentials");
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-r from-brandPrimary to-brandAccent flex items-center justify-center">
            <div className="bg-white p-10 rounded-lg shadow-lg w-full max-w-md">
                <h1 className="text-3xl font-bold text-center text-brandPrimary mb-6">Sign In</h1>
                {error && <p className="text-red-500 text-center mb-4">{error}</p>}
                <form onSubmit={handleSubmit} className="space-y-4">
                    <input
                        type="email"
                        placeholder="Email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full border rounded p-3 focus:outline-none focus:ring-2 focus:ring-brandPrimary"
                        required
                    />
                    <input
                        type="password"
                        placeholder="Password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full border rounded p-3 focus:outline-none focus:ring-2 focus:ring-brandPrimary"
                        required
                    />
                    <Button type="submit" className="w-full">
                        Sign In
                    </Button>
                </form>
                <p className="mt-4 text-center text-gray-600">
                    Don't have an account?{" "}
                    <Link href="/signup">
                        <span className="text-brandPrimary hover:underline">Sign Up</span>
                    </Link>
                </p>
                <p className="mt-2 text-center text-sm text-gray-500">
                    Note: Only accounts with role ADMIN, USER, or AUDIT can sign in via the UI. Accounts with the API role are restricted to API access.
                </p>
            </div>
        </div>
    );
}
