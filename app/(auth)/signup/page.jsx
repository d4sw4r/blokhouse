'use client';

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Field } from "@/components/ui/Field";
import { Panel } from "@/components/ui/Panel";

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
        <Panel className="w-full">
            <div className="flex flex-col gap-4 p-2 sm:p-3">
                <div>
                    <h1 className="text-lg font-semibold text-text">Sign Up</h1>
                    <p className="mt-1 text-sm text-muted">Your infrastructure, block by block.</p>
                </div>
                {error && (
                    <p role="alert" className="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-text">
                        {error}
                    </p>
                )}
                {success && (
                    <p role="status" className="rounded-md border border-success/40 bg-success/10 px-3 py-2 text-sm text-text">
                        {success}
                    </p>
                )}
                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                    <Field label="Name" htmlFor="signup-name">
                        <Input
                            id="signup-name"
                            type="text"
                            placeholder="Name"
                            autoComplete="name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            required
                        />
                    </Field>
                    <Field label="Email" htmlFor="signup-email">
                        <Input
                            id="signup-email"
                            type="email"
                            placeholder="Email"
                            autoComplete="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                        />
                    </Field>
                    <Field label="Password" htmlFor="signup-password">
                        <Input
                            id="signup-password"
                            type="password"
                            placeholder="Password"
                            autoComplete="new-password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />
                    </Field>
                    <Button type="submit" className="w-full">
                        Sign Up
                    </Button>
                </form>
                <p className="text-center text-sm text-muted">
                    Already have an account?{" "}
                    <Link href="/signin" className="text-accent underline-offset-2 hover:underline">
                        Sign In
                    </Link>
                </p>
            </div>
        </Panel>
    );
}
