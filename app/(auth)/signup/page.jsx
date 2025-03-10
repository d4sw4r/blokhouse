'use client';

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";

export default function SignUpPage() {
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");
        setSuccess("");
        const res = await fetch("/api/auth/signup", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name, email, password }),
        });
        const data = await res.json();
        if (!res.ok) {
            setError(data.error || "An error occurred");
        } else {
            setSuccess("User created successfully. You can now sign in.");
        }
    };

    return (

        <div className="bg-white p-10 rounded-lg shadow-lg w-full max-w-md">
            <h1 className="text-3xl font-bold text-center text-brandPrimary mb-6">Sign Up</h1>
            {error && <p className="text-red-500 text-center mb-4">{error}</p>}
            {success && <p className="text-green-500 text-center mb-4">{success}</p>}
            <form onSubmit={handleSubmit} className="space-y-4">
                <input
                    type="text"
                    placeholder="Name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full border rounded p-3 focus:outline-none focus:ring-2 focus:ring-brandAccent"
                    required
                />
                <input
                    type="email"
                    placeholder="Email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full border rounded p-3 focus:outline-none focus:ring-2 focus:ring-brandAccent"
                    required
                />
                <input
                    type="password"
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full border rounded p-3 focus:outline-none focus:ring-2 focus:ring-brandAccent"
                    required
                />
                <Button type="submit" className="w-full">
                    Sign Up
                </Button>
            </form>
            <p className="mt-4 text-center text-gray-600">
                Already have an account?{" "}
                <Link href="/signin">
                    <span className="text-brandRoof hover:underline">Sign In</span>
                </Link>
            </p>
        </div>

    );
}
