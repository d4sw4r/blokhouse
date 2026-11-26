'use client';

import { signIn } from "next-auth/react";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Field } from "@/components/ui/Field";
import { Panel } from "@/components/ui/Panel";
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
        <Panel className="w-full">
            <div className="flex flex-col gap-4 p-2 sm:p-3">
                <div>
                    <h1 className="text-lg font-semibold text-text">Sign In</h1>
                    <p className="mt-1 text-sm text-muted">Your infrastructure, block by block.</p>
                </div>
                {error && (
                    <p role="alert" className="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-text">
                        {error}
                    </p>
                )}
                {options.sso && (
                    <Button
                        type="button"
                        className="w-full"
                        onClick={() => signIn("oidc", { callbackUrl: "/dashboard" })}
                    >
                        Sign in with {options.sso.name}
                    </Button>
                )}
                {options.sso && options.passwordLogin && (
                    <p className="text-center text-sm text-muted">or use email and password</p>
                )}
                {options.passwordLogin && (
                    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                        <Field label="Email" htmlFor="signin-email">
                            <Input
                                id="signin-email"
                                type="email"
                                placeholder="Email"
                                autoComplete="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                            />
                        </Field>
                        <Field label="Password" htmlFor="signin-password">
                            <Input
                                id="signin-password"
                                type="password"
                                placeholder="Password"
                                autoComplete="current-password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                            />
                        </Field>
                        <Button type="submit" className="w-full">
                            Sign In
                        </Button>
                    </form>
                )}
                {options.passwordLogin && signupEnabled && (
                    <p className="text-center text-sm text-muted">
                        Don&apos;t have an account?{" "}
                        <Link href="/signup" className="text-accent underline-offset-2 hover:underline">
                            Sign Up
                        </Link>
                    </p>
                )}
                <p className="text-center text-xs text-muted">
                    Accounts with the API role are restricted to API token access.
                </p>
            </div>
        </Panel>
    );
}
