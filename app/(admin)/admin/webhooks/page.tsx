"use client";

import { Fragment, useEffect, useState } from "react";
import Link from "next/link";
import { Webhook as WebhookIcon } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { PageHeader } from "@/components/ui/PageHeader";
import { Panel } from "@/components/ui/Panel";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/Table";
import { SkeletonTable } from "@/components/Skeleton";
import CopyButton from "@/components/CopyButton";

interface Webhook {
    id: string;
    name: string;
    url: string;
    events: string[];
    active: boolean;
    lastDelivery: { status: string; responseStatus: number | null; createdAt: string } | null;
}

interface Delivery {
    id: string;
    event: string;
    status: "pending" | "success" | "failed";
    attempts: number;
    responseStatus: number | null;
    error: string | null;
    durationMs: number | null;
    nextAttemptAt: string | null;
    createdAt: string;
    payload?: unknown;
}

const EVENTS = [
    { id: "item.created", hint: "An item was created" },
    { id: "item.updated", hint: "Fields, tags or custom fields of an item changed" },
    { id: "item.deleted", hint: "An item was deleted" },
];

const API = "/api/v1/webhooks";

async function api<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(API + path, {
        ...init,
        headers: { "content-type": "application/json", ...(init?.headers || {}) },
    });
    if (res.status === 204) return undefined as T;
    const body = await res.json();
    if (!res.ok) {
        const details = (body.error?.details || []).map((d: { path: string; message: string }) => `${d.path}: ${d.message}`);
        throw new Error([body.error?.message || `HTTP ${res.status}`, ...details].join(" — "));
    }
    return body.data as T;
}

function StatusBadge({ status, code }: { status: string; code?: number | null }) {
    const tone = status === "success" ? "success" : status === "failed" ? "danger" : "warning";
    return (
        <Badge tone={tone}>
            {status}
            {code ? ` (${code})` : ""}
        </Badge>
    );
}

export default function WebhooksPage() {
    const [hooks, setHooks] = useState<Webhook[]>([]);
    const [loading, setLoading] = useState(true);
    const [name, setName] = useState("");
    const [url, setUrl] = useState("");
    const [events, setEvents] = useState<string[]>(["*"]);
    const [secret, setSecret] = useState<{ name: string; value: string } | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [message, setMessage] = useState<string | null>(null);
    const [openId, setOpenId] = useState<string | null>(null);
    const [deliveries, setDeliveries] = useState<Delivery[]>([]);
    const [hookToRotate, setHookToRotate] = useState<Webhook | null>(null);
    const [hookToRotateOpen, setHookToRotateOpen] = useState(false);
    const [hookToDelete, setHookToDelete] = useState<Webhook | null>(null);
    const [hookToDeleteOpen, setHookToDeleteOpen] = useState(false);

    const load = async () => {
        try {
            setHooks(await api<Webhook[]>(""));
        } catch (e) {
            setError((e as Error).message);
        }
        setLoading(false);
    };

    useEffect(() => {
        const run = async () => { await load(); };
        run();
    }, []);

    const run = async (fn: () => Promise<void>) => {
        setError(null);
        setMessage(null);
        try {
            await fn();
        } catch (e) {
            setError((e as Error).message);
        }
    };

    const toggleEvent = (id: string) => {
        setEvents((prev) => {
            if (id === "*") return ["*"];
            const list = prev.filter((e) => e !== "*");
            const next = list.includes(id) ? list.filter((e) => e !== id) : [...list, id];
            return next.length ? next : ["*"];
        });
    };

    const create = (e: React.FormEvent) => {
        e.preventDefault();
        run(async () => {
            const hook = await api<Webhook & { secret: string }>("", {
                method: "POST",
                body: JSON.stringify({ name, url, events }),
            });
            setSecret({ name: hook.name, value: hook.secret });
            setName("");
            setUrl("");
            setEvents(["*"]);
            await load();
        });
    };

    const showDeliveries = (id: string) =>
        run(async () => {
            setDeliveries(await api<Delivery[]>(`/${id}/deliveries?per_page=25`));
            setOpenId(id);
        });

    const ping = (hook: Webhook) =>
        run(async () => {
            const d = await api<Delivery>(`/${hook.id}/ping`, { method: "POST" });
            setMessage(
                d.status === "success"
                    ? `Ping to "${hook.name}" delivered (HTTP ${d.responseStatus}, ${d.durationMs} ms).`
                    : `Ping to "${hook.name}" failed: ${d.error}. It will be retried.`
            );
            await load();
            if (openId === hook.id) await showDeliveries(hook.id);
        });

    const toggleActive = (hook: Webhook) =>
        run(async () => {
            await api(`/${hook.id}`, { method: "PATCH", body: JSON.stringify({ active: !hook.active }) });
            await load();
        });

    const rotate = (hook: Webhook) => {
        run(async () => {
            const updated = await api<Webhook & { secret: string }>(`/${hook.id}`, {
                method: "PATCH",
                body: JSON.stringify({ rotateSecret: true }),
            });
            setSecret({ name: updated.name, value: updated.secret });
        });
    };

    const remove = (hook: Webhook) => {
        run(async () => {
            await api(`/${hook.id}`, { method: "DELETE" });
            if (openId === hook.id) setOpenId(null);
            await load();
        });
    };

    const redeliver = (hookId: string, deliveryId: string) =>
        run(async () => {
            await api(`/${hookId}/deliveries/${deliveryId}/redeliver`, { method: "POST" });
            await showDeliveries(hookId);
            await load();
        });

    if (loading) return <SkeletonTable rows={4} />;

    return (
        <div className="space-y-6">
            <PageHeader
                title="Webhooks"
                description={
                    <>
                        Blokhouse sends a signed <code className="font-mono">POST</code> to these URLs when
                        configuration items are created, changed or deleted, from the UI, the API or automation.
                        Failed deliveries are retried for about 7 hours. See{" "}
                        <Link className="text-accent underline" href="/docs">API docs</Link> → Webhooks for the
                        payload and how to verify the signature.
                    </>
                }
            />

            <Panel title="Add webhook">
                <form onSubmit={create} className="space-y-4">
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-[16rem_1fr]">
                        <Field label="Name" htmlFor="hook-name">
                            <Input
                                id="hook-name"
                                placeholder="e.g. AWX inventory sync"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                maxLength={100}
                                required
                            />
                        </Field>
                        <Field label="URL" htmlFor="hook-url">
                            <Input
                                id="hook-url"
                                type="url"
                                placeholder="https://automation.example.com/hooks/blokhouse"
                                value={url}
                                onChange={(e) => setUrl(e.target.value)}
                                required
                            />
                        </Field>
                    </div>
                    <fieldset>
                        <legend className="mb-1.5 text-sm font-medium text-text">Events</legend>
                        <div className="flex flex-wrap gap-x-6 gap-y-2">
                            <label className="flex min-h-9 items-center gap-2 text-sm max-sm:min-h-11">
                                <Checkbox checked={events.includes("*")} onCheckedChange={() => toggleEvent("*")} />
                                <span>All events</span>
                            </label>
                            {EVENTS.map((ev) => (
                                <label key={ev.id} className="flex min-h-9 items-center gap-2 text-sm max-sm:min-h-11" title={ev.hint}>
                                    <Checkbox checked={events.includes(ev.id)} onCheckedChange={() => toggleEvent(ev.id)} />
                                    <span className="font-mono">{ev.id}</span>
                                </label>
                            ))}
                        </div>
                    </fieldset>
                    <Button type="submit">Add webhook</Button>
                </form>
            </Panel>

            {error && (
                <p className="rounded-md border border-danger/40 bg-danger/10 p-3 text-sm text-danger" role="alert">
                    {error}
                </p>
            )}
            {message && (
                <p className="rounded-md border border-border bg-surface p-3 text-sm text-text" role="status">
                    {message}
                </p>
            )}

            {secret && (
                <div role="status" className="space-y-2 rounded-lg border-2 border-warning bg-warning/10 p-4">
                    <p className="text-sm font-semibold text-text">
                        Signing secret for &quot;{secret.name}&quot;. Copy it now; it will not be shown again.
                    </p>
                    <div className="flex items-center gap-2">
                        <code className="min-w-0 font-mono text-[13px] break-all text-text">{secret.value}</code>
                        <CopyButton text={secret.value} />
                    </div>
                </div>
            )}

            {hooks.length === 0 ? (
                <EmptyState
                    icon={WebhookIcon}
                    title="No webhooks yet."
                    description="Add a webhook above to notify other systems when items change."
                />
            ) : (
                <Table>
                    <THead>
                        <tr>
                            <TH>Name</TH>
                            <TH>URL</TH>
                            <TH>Events</TH>
                            <TH>Last delivery</TH>
                            <TH className="relative">
                                <span className="sr-only">Actions</span>
                            </TH>
                        </tr>
                    </THead>
                    <TBody>
                        {hooks.map((hook) => (
                            <Fragment key={hook.id}>
                                <TR className={hook.active ? "" : "opacity-70"}>
                                    <TD>
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className="font-mono text-[13px]">{hook.name}</span>
                                            {!hook.active && <Badge>disabled</Badge>}
                                        </div>
                                    </TD>
                                    <TD mono className="max-w-xs break-all">{hook.url}</TD>
                                    <TD mono>{hook.events.includes("*") ? "all" : hook.events.join(", ")}</TD>
                                    <TD>
                                        {hook.lastDelivery ? (
                                            <span title={new Date(hook.lastDelivery.createdAt).toLocaleString()}>
                                                <StatusBadge status={hook.lastDelivery.status} code={hook.lastDelivery.responseStatus} />
                                            </span>
                                        ) : (
                                            "—"
                                        )}
                                    </TD>
                                    <TD>
                                        <div className="flex flex-wrap justify-end gap-2">
                                            <Button size="sm" variant="secondary" onClick={() => ping(hook)}>Send test</Button>
                                            <Button
                                                size="sm"
                                                variant="secondary"
                                                onClick={() => (openId === hook.id ? setOpenId(null) : showDeliveries(hook.id))}
                                            >
                                                {openId === hook.id ? "Hide log" : "Deliveries"}
                                            </Button>
                                            <Button size="sm" variant="secondary" onClick={() => toggleActive(hook)}>
                                                {hook.active ? "Disable" : "Enable"}
                                            </Button>
                                            <Button size="sm" variant="secondary" onClick={() => { setHookToRotate(hook); setHookToRotateOpen(true); }}>New secret</Button>
                                            <Button size="sm" variant="danger" onClick={() => { setHookToDelete(hook); setHookToDeleteOpen(true); }}>Delete</Button>
                                        </div>
                                    </TD>
                                </TR>
                                {openId === hook.id && (
                                    <tr>
                                        <td colSpan={5} className="bg-surface-2 p-4">
                                            {deliveries.length === 0 ? (
                                                <p className="text-sm text-muted">No deliveries yet.</p>
                                            ) : (
                                                <div className="overflow-x-auto">
                                                    <table className="min-w-full text-sm">
                                                        <thead>
                                                            <tr className="text-left text-xs text-muted">
                                                                <th className="py-1 pr-4 font-medium">Time</th>
                                                                <th className="py-1 pr-4 font-medium">Event</th>
                                                                <th className="py-1 pr-4 font-medium">Status</th>
                                                                <th className="py-1 pr-4 font-medium">Attempts</th>
                                                                <th className="py-1 pr-4 font-medium">Error / next attempt</th>
                                                                <th className="py-1 pr-4"><span className="sr-only">Actions</span></th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-border">
                                                            {deliveries.map((d) => (
                                                                <tr key={d.id} className="align-top">
                                                                    <td className="py-2 pr-4 whitespace-nowrap">{new Date(d.createdAt).toLocaleString()}</td>
                                                                    <td className="py-2 pr-4 font-mono">{d.event}</td>
                                                                    <td className="py-2 pr-4"><StatusBadge status={d.status} code={d.responseStatus} /></td>
                                                                    <td className="py-2 pr-4 font-mono">{d.attempts}</td>
                                                                    <td className="py-2 pr-4">
                                                                        {d.error}
                                                                        {d.nextAttemptAt && (
                                                                            <span className="block text-xs text-muted">
                                                                                next: {new Date(d.nextAttemptAt).toLocaleString()}
                                                                            </span>
                                                                        )}
                                                                        <details>
                                                                            <summary className="cursor-pointer text-xs text-accent">Payload</summary>
                                                                            <pre className="max-w-2xl overflow-x-auto font-mono text-xs">
                                                                                {JSON.stringify(d.payload, null, 2)}
                                                                            </pre>
                                                                        </details>
                                                                    </td>
                                                                    <td className="py-2 pr-4">
                                                                        <Button size="sm" variant="secondary" onClick={() => redeliver(hook.id, d.id)}>
                                                                            Redeliver
                                                                        </Button>
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                )}
                            </Fragment>
                        ))}
                    </TBody>
                </Table>
            )}

            <ConfirmDialog
                open={hookToRotateOpen}
                onOpenChange={setHookToRotateOpen}
                title="Generate a new secret"
                description={`Generate a new secret for "${hookToRotate?.name ?? ""}"? The receiver must be updated, or it will reject events.`}
                confirmLabel="Generate"
                onConfirm={() => hookToRotate && rotate(hookToRotate)}
            />
            <ConfirmDialog
                open={hookToDeleteOpen}
                onOpenChange={setHookToDeleteOpen}
                title="Delete webhook"
                description={`Delete webhook "${hookToDelete?.name ?? ""}" and its delivery log?`}
                confirmLabel="Delete"
                tone="danger"
                onConfirm={() => hookToDelete && remove(hookToDelete)}
            />
        </div>
    );
}
