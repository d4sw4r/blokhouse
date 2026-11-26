"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/Button";
import CopyButton from "@/components/CopyButton";

interface ApiToken {
    id: string;
    name: string;
    prefix: string;
    scopes: string[];
    expiresAt: string | null;
    lastUsedAt: string | null;
    createdAt: string;
}

const ALL_SCOPES = [
    { id: "read", label: "read", hint: "Read CMDB data (inventories, items, …)" },
    { id: "write", label: "write", hint: "Create, update and delete CMDB data" },
    { id: "audit", label: "audit", hint: "Read audit logs" },
    { id: "admin", label: "admin", hint: "Manage users and system settings" },
];

export default function AdminAPIPage() {
    const [tokens, setTokens] = useState<ApiToken[]>([]);
    const [loading, setLoading] = useState(true);
    const [name, setName] = useState("");
    const [scopes, setScopes] = useState<string[]>(["read"]);
    const [expiresInDays, setExpiresInDays] = useState("90");
    const [newSecret, setNewSecret] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const { data: session } = useSession();
    const [maxDays, setMaxDays] = useState<number | null>(null);
    const limited = Boolean((session?.user as { sso?: boolean } | undefined)?.sso) && maxDays !== null;

    useEffect(() => {
        fetch("/api/auth/options")
            .then((r) => (r.ok ? r.json() : null))
            .then((d) => setMaxDays(typeof d?.ssoTokenMaxDays === "number" ? d.ssoTokenMaxDays : null))
            .catch(() => {});
    }, []);

    const fetchTokens = async () => {
        try {
            const res = await fetch("/api/api-tokens");
            if (res.ok) {
                setTokens(await res.json());
            } else {
                console.error("Failed to fetch tokens:", await res.text());
            }
        } catch (err) {
            console.error("Error fetching tokens:", err);
        }
        setLoading(false);
    };

    useEffect(() => {
        const load = async () => { await fetchTokens(); };
        load();
    }, []);

    const toggleScope = (scope: string) => {
        setScopes((prev) => (prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope]));
    };

    const generateToken = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setNewSecret(null);
        const effectiveDays =
            limited && maxDays !== null && (expiresInDays === "" || Number(expiresInDays) > maxDays)
                ? String(maxDays)
                : expiresInDays;
        try {
            const res = await fetch("/api/api-tokens", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: name || "API token",
                    scopes,
                    expiresInDays: effectiveDays === "" ? null : Number(effectiveDays),
                }),
            });
            const data = await res.json();
            if (res.ok) {
                const { token, ...meta } = data;
                setNewSecret(token);
                setTokens((prev) => [meta, ...prev]);
                setName("");
            } else {
                setError(data.error || "Failed to generate token");
            }
        } catch (err) {
            console.error("Error generating token:", err);
            setError("Failed to generate token");
        }
    };

    const deleteToken = async (id: string) => {
        if (!confirm("Revoke this token? Integrations using it will stop working.")) return;
        try {
            const res = await fetch(`/api/api-tokens/${id}`, { method: "DELETE" });
            if (res.ok) {
                setTokens((prev) => prev.filter((token) => token.id !== id));
            } else {
                console.error("Failed to delete token:", await res.text());
            }
        } catch (err) {
            console.error("Error deleting token:", err);
        }
    };

    if (loading) return <p className="text-lg">Loading tokens...</p>;

    return (
        <div className="space-y-6">
            <h1 className="text-4xl font-bold text-brand-text">API Tokens</h1>
            <p className="text-lg text-brand-secondary">
                Tokens authenticate automation (Ansible, Puppet, scripts) via{" "}
                <code className="font-mono">Authorization: Bearer &lt;token&gt;</code>. A token can never have
                more permissions than your own role.
            </p>

            <form onSubmit={generateToken} className="space-y-4 p-4 border rounded-sm bg-white dark:bg-gray-800">
                <div>
                    <label className="block text-sm font-medium mb-1" htmlFor="token-name">Name</label>
                    <input
                        id="token-name"
                        className="border rounded-sm px-3 py-2 w-full max-w-md"
                        placeholder="e.g. ansible-prod"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        maxLength={100}
                    />
                </div>
                <fieldset>
                    <legend className="block text-sm font-medium mb-1">Scopes</legend>
                    <div className="flex flex-wrap gap-4">
                        {ALL_SCOPES.map((s) => (
                            <label key={s.id} className="flex items-center gap-2" title={s.hint}>
                                <input type="checkbox" checked={scopes.includes(s.id)} onChange={() => toggleScope(s.id)} />
                                <span className="font-mono">{s.label}</span>
                            </label>
                        ))}
                    </div>
                </fieldset>
                <div>
                    <label className="block text-sm font-medium mb-1" htmlFor="token-exp">Expires in (days)</label>
                    <select
                        id="token-exp"
                        className="border rounded-sm px-3 py-2"
                        value={limited && maxDays !== null && Number(expiresInDays || 0) > maxDays ? String(maxDays) : expiresInDays}
                        onChange={(e) => setExpiresInDays(e.target.value)}
                    >
                        {[30, 90, 365]
                            .filter((d) => !limited || d <= (maxDays as number))
                            .map((d) => (
                                <option key={d} value={String(d)}>{d}</option>
                            ))}
                        {limited && maxDays !== null && ![30, 90, 365].includes(maxDays) && (
                            <option value={String(maxDays)}>{maxDays}</option>
                        )}
                        {!limited && <option value="">Never</option>}
                    </select>
                    {limited && (
                        <p className="text-xs text-brand-secondary mt-1">
                            Tokens for SSO accounts expire after at most {maxDays} days.
                        </p>
                    )}
                </div>
                {error && <p className="text-red-600">{error}</p>}
                <Button type="submit" disabled={scopes.length === 0}>Generate API Token</Button>
            </form>

            {newSecret && (
                <div className="p-4 border-2 border-yellow-500 rounded-sm bg-yellow-50 dark:bg-yellow-900/30 space-y-2">
                    <p className="font-semibold">Copy your new token now — it will not be shown again.</p>
                    <div className="flex items-center gap-2">
                        <code className="font-mono break-all">{newSecret}</code>
                        <CopyButton text={newSecret} />
                    </div>
                </div>
            )}

            <div className="overflow-x-auto mt-6">
                {tokens.length === 0 ? (
                    <p className="text-brand-secondary">No API tokens found.</p>
                ) : (
                    <table className="min-w-full bg-white dark:bg-gray-800 shadow-sm rounded-sm">
                        <thead className="bg-brand-primary/10">
                            <tr>
                                <th className="py-2 px-4 border">Name</th>
                                <th className="py-2 px-4 border">Token</th>
                                <th className="py-2 px-4 border">Scopes</th>
                                <th className="py-2 px-4 border">Expires</th>
                                <th className="py-2 px-4 border">Last used</th>
                                <th className="py-2 px-4 border">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {tokens.map((token) => (
                                <tr key={token.id}>
                                    <td className="py-2 px-4 border">{token.name}</td>
                                    <td className="py-2 px-4 border font-mono">{token.prefix}…</td>
                                    <td className="py-2 px-4 border font-mono">{token.scopes.join(", ")}</td>
                                    <td className="py-2 px-4 border">
                                        {token.expiresAt ? new Date(token.expiresAt).toLocaleDateString() : "never"}
                                    </td>
                                    <td className="py-2 px-4 border">
                                        {token.lastUsedAt ? new Date(token.lastUsedAt).toLocaleString() : "—"}
                                    </td>
                                    <td className="py-2 px-4 border">
                                        <Button onClick={() => deleteToken(token.id)}>Revoke</Button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}
