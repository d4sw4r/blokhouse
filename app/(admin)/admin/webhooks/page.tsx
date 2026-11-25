"use client";

import { Fragment, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
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
    const color =
        status === "success"
            ? "bg-green-100 text-green-800"
            : status === "failed"
              ? "bg-red-100 text-red-800"
              : "bg-yellow-100 text-yellow-800";
    return (
        <span className={`px-2 py-0.5 rounded-sm text-xs font-medium ${color}`}>
            {status}
            {code ? ` (${code})` : ""}
        </span>
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
        if (!confirm(`Generate a new secret for "${hook.name}"? The receiver must be updated, or it will reject events.`)) return;
        run(async () => {
            const updated = await api<Webhook & { secret: string }>(`/${hook.id}`, {
                method: "PATCH",
                body: JSON.stringify({ rotateSecret: true }),
            });
            setSecret({ name: updated.name, value: updated.secret });
        });
    };

    const remove = (hook: Webhook) => {
        if (!confirm(`Delete webhook "${hook.name}" and its delivery log?`)) return;
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

    if (loading) return <p className="text-lg">Loading webhooks...</p>;

    return (
        <div className="space-y-6">
            <h1 className="text-4xl font-bold text-brand-text">Webhooks</h1>
            <p className="text-lg text-brand-secondary">
                Blokhouse sends a signed <code className="font-mono">POST</code> to these URLs when configuration
                items are created, changed or deleted, from the UI, the API or automation. Failed deliveries are
                retried for about 7 hours. See <a className="underline" href="/docs">API docs</a> → Webhooks for
                the payload and how to verify the signature.
            </p>

            <form onSubmit={create} className="space-y-4 p-4 border rounded-sm bg-white dark:bg-gray-800">
                <div className="flex flex-wrap gap-4">
                    <div>
                        <label className="block text-sm font-medium mb-1" htmlFor="hook-name">Name</label>
                        <input
                            id="hook-name"
                            className="border rounded-sm px-3 py-2 w-64"
                            placeholder="e.g. AWX inventory sync"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            maxLength={100}
                            required
                        />
                    </div>
                    <div className="grow">
                        <label className="block text-sm font-medium mb-1" htmlFor="hook-url">URL</label>
                        <input
                            id="hook-url"
                            type="url"
                            className="border rounded-sm px-3 py-2 w-full max-w-xl"
                            placeholder="https://automation.example.com/hooks/blokhouse"
                            value={url}
                            onChange={(e) => setUrl(e.target.value)}
                            required
                        />
                    </div>
                </div>
                <fieldset>
                    <legend className="block text-sm font-medium mb-1">Events</legend>
                    <div className="flex flex-wrap gap-4">
                        <label className="flex items-center gap-2">
                            <input type="checkbox" checked={events.includes("*")} onChange={() => toggleEvent("*")} />
                            <span>All events</span>
                        </label>
                        {EVENTS.map((ev) => (
                            <label key={ev.id} className="flex items-center gap-2" title={ev.hint}>
                                <input type="checkbox" checked={events.includes(ev.id)} onChange={() => toggleEvent(ev.id)} />
                                <span className="font-mono">{ev.id}</span>
                            </label>
                        ))}
                    </div>
                </fieldset>
                <Button type="submit">Add webhook</Button>
            </form>

            {error && <p className="text-red-600" role="alert">{error}</p>}
            {message && <p className="text-brand-text" role="status">{message}</p>}

            {secret && (
                <div className="p-4 border-2 border-yellow-500 rounded-sm bg-yellow-50 dark:bg-yellow-900/30 space-y-2">
                    <p className="font-semibold">
                        Signing secret for &quot;{secret.name}&quot;. Copy it now; it will not be shown again.
                    </p>
                    <div className="flex items-center gap-2">
                        <code className="font-mono break-all">{secret.value}</code>
                        <CopyButton text={secret.value} />
                    </div>
                </div>
            )}

            <div className="overflow-x-auto">
                {hooks.length === 0 ? (
                    <p className="text-brand-secondary">No webhooks yet.</p>
                ) : (
                    <table className="min-w-full bg-white dark:bg-gray-800 shadow-sm rounded-sm">
                        <thead className="bg-brand-primary/10">
                            <tr>
                                <th className="py-2 px-4 border text-left">Name</th>
                                <th className="py-2 px-4 border text-left">URL</th>
                                <th className="py-2 px-4 border text-left">Events</th>
                                <th className="py-2 px-4 border text-left">Last delivery</th>
                                <th className="py-2 px-4 border text-left">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {hooks.map((hook) => (
                                <Fragment key={hook.id}>
                                    <tr className={hook.active ? "" : "opacity-60"}>
                                        <td className="py-2 px-4 border">
                                            {hook.name}
                                            {!hook.active && <span className="ml-2 text-xs">(disabled)</span>}
                                        </td>
                                        <td className="py-2 px-4 border font-mono text-sm break-all">{hook.url}</td>
                                        <td className="py-2 px-4 border font-mono text-sm">
                                            {hook.events.includes("*") ? "all" : hook.events.join(", ")}
                                        </td>
                                        <td className="py-2 px-4 border">
                                            {hook.lastDelivery ? (
                                                <span title={new Date(hook.lastDelivery.createdAt).toLocaleString()}>
                                                    <StatusBadge status={hook.lastDelivery.status} code={hook.lastDelivery.responseStatus} />
                                                </span>
                                            ) : (
                                                "—"
                                            )}
                                        </td>
                                        <td className="py-2 px-4 border">
                                            <div className="flex flex-wrap gap-2">
                                                <Button size="sm" onClick={() => ping(hook)}>Send test</Button>
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => (openId === hook.id ? setOpenId(null) : showDeliveries(hook.id))}
                                                >
                                                    {openId === hook.id ? "Hide log" : "Deliveries"}
                                                </Button>
                                                <Button size="sm" variant="outline" onClick={() => toggleActive(hook)}>
                                                    {hook.active ? "Disable" : "Enable"}
                                                </Button>
                                                <Button size="sm" variant="outline" onClick={() => rotate(hook)}>New secret</Button>
                                                <Button size="sm" variant="destructive" onClick={() => remove(hook)}>Delete</Button>
                                            </div>
                                        </td>
                                    </tr>
                                    {openId === hook.id && (
                                        <tr>
                                            <td colSpan={5} className="p-4 border bg-brand-background">
                                                {deliveries.length === 0 ? (
                                                    <p className="text-brand-secondary">No deliveries yet.</p>
                                                ) : (
                                                    <table className="min-w-full text-sm">
                                                        <thead>
                                                            <tr className="text-left">
                                                                <th className="py-1 pr-4">Time</th>
                                                                <th className="py-1 pr-4">Event</th>
                                                                <th className="py-1 pr-4">Status</th>
                                                                <th className="py-1 pr-4">Attempts</th>
                                                                <th className="py-1 pr-4">Error / next attempt</th>
                                                                <th className="py-1 pr-4"></th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {deliveries.map((d) => (
                                                                <tr key={d.id} className="align-top border-t">
                                                                    <td className="py-1 pr-4 whitespace-nowrap">{new Date(d.createdAt).toLocaleString()}</td>
                                                                    <td className="py-1 pr-4 font-mono">{d.event}</td>
                                                                    <td className="py-1 pr-4"><StatusBadge status={d.status} code={d.responseStatus} /></td>
                                                                    <td className="py-1 pr-4">{d.attempts}</td>
                                                                    <td className="py-1 pr-4">
                                                                        {d.error}
                                                                        {d.nextAttemptAt && (
                                                                            <span className="block text-xs text-brand-secondary">
                                                                                next: {new Date(d.nextAttemptAt).toLocaleString()}
                                                                            </span>
                                                                        )}
                                                                        <details>
                                                                            <summary className="cursor-pointer text-xs">Payload</summary>
                                                                            <pre className="text-xs overflow-x-auto max-w-2xl">
                                                                                {JSON.stringify(d.payload, null, 2)}
                                                                            </pre>
                                                                        </details>
                                                                    </td>
                                                                    <td className="py-1 pr-4">
                                                                        <Button size="sm" variant="outline" onClick={() => redeliver(hook.id, d.id)}>
                                                                            Redeliver
                                                                        </Button>
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                )}
                                            </td>
                                        </tr>
                                    )}
                                </Fragment>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}
