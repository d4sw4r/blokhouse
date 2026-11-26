'use client';

import { signIn } from "next-auth/react";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import Logo from "@/components/Logo";
import { ssoErrorMessage } from "@/lib/sso-errors";

export default function SignInPage() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [signupEnabled, setSignupEnabled] = useState(false);
    const [options, setOptions] = useState({ passwordLogin: true, sso: null });

    useEffect(() => {
        const code = new URLSearchParams(window.location.search).get("error");
        if (code) setError(ssoErrorMessage(code));
        fetch("/api/auth/options")
            .then((r) => (r.ok ? r.json() : null))
            .then((d) => d && setOptions({ passwordLogin: d.passwordLogin !== false, sso: d.sso || null }))
            .catch(() => {});
    }, []);

    useEffect(() => {
        fetch("/api/auth/signup")
            .then((r) => (r.ok ? r.json() : { enabled: false }))
            .then((d) => setSignupEnabled(Boolean(d.enabled)))
            .catch(() => setSignupEnabled(false));
    }, []);

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

        <div className="bg-white p-10 rounded-lg shadow-lg w-full max-w-md">
            <div className="flex justify-center mb-4">
                <Logo />
            </div>
            <p className="text-center text-gray-500 mb-6">Your infrastructure, block by block.</p>
            <h1 className="text-3xl font-bold text-center text-brandPrimary mb-6">Sign In</h1>
            {error && <p className="text-red-500 text-center mb-4">{error}</p>}
            {options.sso && (
                <Button
                    type="button"
                    className="w-full mb-4"
                    onClick={() => signIn("oidc", { callbackUrl: "/dashboard" })}
                >
                    Sign in with {options.sso.name}
                </Button>
            )}
            {options.sso && options.passwordLogin && (
                <p className="text-center text-sm text-gray-500 mb-4">or use email and password</p>
            )}
            {options.passwordLogin && (
            <form onSubmit={handleSubmit} className="space-y-4">
                <input
                    type="email"
                    placeholder="Email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full border rounded-sm p-3 focus:outline-hidden focus:ring-2 focus:ring-brandPrimary"
                    required
                />
                <input
                    type="password"
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full border rounded-sm p-3 focus:outline-hidden focus:ring-2 focus:ring-brandPrimary"
                    required
                />
                <Button type="submit" className="w-full">
                    Sign In
                </Button>
            </form>
            )}
            {options.passwordLogin && signupEnabled && (
                <p className="mt-4 text-center text-gray-600">
                    Don&apos;t have an account?{" "}
                    <Link href="/signup">
                        <span className="text-brandPrimary hover:underline">Sign Up</span>
                    </Link>
                </p>
            )}
            <p className="mt-2 text-center text-sm text-gray-500">
                Accounts with the API role are restricted to API token access.
            </p>
        </div>

    );
}
