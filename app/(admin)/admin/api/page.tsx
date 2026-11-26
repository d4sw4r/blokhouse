"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { KeyRound } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { PageHeader } from "@/components/ui/PageHeader";
import { Panel } from "@/components/ui/Panel";
import { Select } from "@/components/ui/Select";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/Table";
import { SkeletonTable } from "@/components/Skeleton";
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
    const [tokenToRevoke, setTokenToRevoke] = useState<ApiToken | null>(null);
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

    if (loading) return <SkeletonTable rows={4} />;

    const expiryValue =
        limited && maxDays !== null && Number(expiresInDays || 0) > maxDays ? String(maxDays) : expiresInDays;
    const expiryOptions = [
        ...[30, 90, 365]
            .filter((d) => !limited || d <= (maxDays as number))
            .map((d) => ({ value: String(d), label: String(d) })),
        ...(limited && maxDays !== null && ![30, 90, 365].includes(maxDays)
            ? [{ value: String(maxDays), label: String(maxDays) }]
            : []),
        ...(!limited ? [{ value: "", label: "Never" }] : []),
    ];

    return (
        <div className="space-y-6">
            <PageHeader
                title="API tokens"
                description={
                    <>
                        Tokens authenticate automation (Ansible, Puppet, scripts) via{" "}
                        <code className="font-mono break-all">Authorization: Bearer &lt;token&gt;</code>. A token can
                        never have more permissions than your own role.
                    </>
                }
            />

            <Panel title="Generate token">
                <form onSubmit={generateToken} className="space-y-4">
                    <Field label="Name" htmlFor="token-name" className="max-w-md">
                        <Input
                            id="token-name"
                            placeholder="e.g. ansible-prod"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            maxLength={100}
                        />
                    </Field>
                    <fieldset>
                        <legend className="mb-1.5 text-sm font-medium text-text">Scopes</legend>
                        <div className="flex flex-wrap gap-x-6 gap-y-2">
                            {ALL_SCOPES.map((s) => (
                                <label key={s.id} className="flex min-h-9 items-center gap-2 text-sm max-sm:min-h-11" title={s.hint}>
                                    <Checkbox checked={scopes.includes(s.id)} onCheckedChange={() => toggleScope(s.id)} />
                                    <span className="font-mono">{s.label}</span>
                                </label>
                            ))}
                        </div>
                    </fieldset>
                    <Field
                        label="Expires in (days)"
                        htmlFor="token-exp"
                        className="max-w-xs"
                        hint={limited ? `Tokens for SSO accounts expire after at most ${maxDays} days.` : undefined}
                    >
                        <Select id="token-exp" value={expiryValue} onValueChange={setExpiresInDays} options={expiryOptions} />
                    </Field>
                    {error && <p role="alert" className="text-sm text-danger">{error}</p>}
                    <Button type="submit" disabled={scopes.length === 0}>Generate API Token</Button>
                </form>
            </Panel>

            {newSecret && (
                <div role="status" className="space-y-2 rounded-lg border-2 border-warning bg-warning/10 p-4">
                    <p className="text-sm font-semibold text-text">
                        Copy your new token now — it will not be shown again.
                    </p>
                    <div className="flex items-center gap-2">
                        <code className="min-w-0 font-mono text-[13px] break-all text-text">{newSecret}</code>
                        <CopyButton text={newSecret} />
                    </div>
                </div>
            )}

            {tokens.length === 0 ? (
                <EmptyState
                    icon={KeyRound}
                    title="No API tokens found."
                    description="Generate a token above to authenticate scripts and automation."
                />
            ) : (
                <Table>
                    <THead>
                        <tr>
                            <TH>Name</TH>
                            <TH>Token</TH>
                            <TH>Scopes</TH>
                            <TH>Expires</TH>
                            <TH>Last used</TH>
                            <TH className="relative">
                                <span className="sr-only">Actions</span>
                            </TH>
                        </tr>
                    </THead>
                    <TBody>
                        {tokens.map((token) => (
                            <TR key={token.id}>
                                <TD>{token.name}</TD>
                                <TD mono>{token.prefix}…</TD>
                                <TD mono>{token.scopes.join(", ")}</TD>
                                <TD className="whitespace-nowrap">
                                    {token.expiresAt ? new Date(token.expiresAt).toLocaleDateString() : "never"}
                                </TD>
                                <TD className="whitespace-nowrap">
                                    {token.lastUsedAt ? new Date(token.lastUsedAt).toLocaleString() : "—"}
                                </TD>
                                <TD>
                                    <div className="flex justify-end">
                                        <Button size="sm" variant="danger" onClick={() => setTokenToRevoke(token)}>Revoke</Button>
                                    </div>
                                </TD>
                            </TR>
                        ))}
                    </TBody>
                </Table>
            )}

            <ConfirmDialog
                open={tokenToRevoke !== null}
                onOpenChange={(open) => !open && setTokenToRevoke(null)}
                title="Revoke token"
                description="Revoke this token? Integrations using it will stop working."
                confirmLabel="Revoke"
                tone="danger"
                onConfirm={() => tokenToRevoke && deleteToken(tokenToRevoke.id)}
            />
        </div>
    );
}
