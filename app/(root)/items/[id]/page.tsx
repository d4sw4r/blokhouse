// app/(root)/items/[id]/page.tsx
"use client";

import { useSession } from "next-auth/react";
import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useToast } from "@/components/ToastProvider";
import { ArrowLeft, Pencil, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Panel } from "@/components/ui/Panel";
import { Select } from "@/components/ui/Select";
import { StatusDot } from "@/components/ui/StatusDot";
import { Skeleton } from "@/components/Skeleton";
import CopyButton from "@/components/CopyButton";
import { TagBadge } from "@/components/TagBadge";
import AssetRelations from "@/components/AssetRelations";
import FavoriteButton from "@/components/FavoriteButton";
import { auditAction } from "@/lib/ui/auditActions";

interface Tag {
    id: string;
    name: string;
    color?: string | null;
}

type AssetStatus = "ACTIVE" | "DEPRECATED" | "MAINTENANCE";

interface ConfigItem {
    id: string;
    name: string;
    description?: string;
    ip?: string;
    mac?: string;
    itemTypeId?: string;
    itemType?: { id: string; name: string } | null;
    status: AssetStatus;
    tags: Tag[];
    createdAt: string;
    updatedAt: string;
    user?: { id: string; name: string | null; email: string | null } | null;
}

interface AuditLogEntry {
    id: string;
    action: string;
    description: string | null;
    oldValues: string | null;
    newValues: string | null;
    createdAt: string;
    user?: { id: string; name: string | null; email: string | null } | null;
}

interface CustomField {
    id: string;
    name: string;
    label: string;
    description: string | null;
    type: string;
    required: boolean;
    defaultValue: string | null;
    options: string[];
}

interface CustomFieldWithValue extends CustomField {
    value: string | null;
    valueId: string | null;
}

function formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleString("de-DE", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
}

function formatTimeAgo(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (seconds < 60) return "just now";
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}d ago`;
    return formatDate(dateString);
}

export default function AssetDetailPage() {
    const { status } = useSession();
    const params = useParams();
    const router = useRouter();
    const { addToast } = useToast();
    const itemId = params.id as string;

    const [item, setItem] = useState<ConfigItem | null>(null);
    const [history, setHistory] = useState<AuditLogEntry[]>([]);
    const [customFieldDefs, setCustomFieldDefs] = useState<CustomField[]>([]);
    const [cfEdits, setCfEdits] = useState<Record<string, string>>({});
    const [cfSaving, setCfSaving] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [confirmDelete, setConfirmDelete] = useState(false);

    useEffect(() => {
        if (status === "authenticated" && itemId) {
            fetchItem();
            fetchHistory();
            fetchCustomFields();
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [status, itemId]); // fetchItem, fetchHistory, fetchCustomFields are defined below and stable within the render

    const fetchItem = async () => {
        try {
            const res = await fetch(`/api/configuration-items/${itemId}`);
            if (!res.ok) {
                if (res.status === 404) {
                    setError("Asset not found");
                } else {
                    setError("Failed to load asset");
                }
                return;
            }
            const data = await res.json();
            setItem(data);
        } catch {
            setError("Network error");
        } finally {
            setLoading(false);
        }
    };

    const fetchCustomFields = async () => {
        try {
            const [valRes, itemRes] = await Promise.all([
                fetch(`/api/configuration-items/${itemId}/custom-fields`),
                fetch(`/api/configuration-items/${itemId}`),
            ]);
            if (valRes.ok) {
                const vals: CustomFieldWithValue[] = await valRes.json();
                // Build edits map from existing values
                const edits: Record<string, string> = {};
                vals.forEach(v => { if (v.value !== null && v.value !== undefined) edits[v.id] = v.value; });
                setCfEdits(edits);
            }
            // After we have the item, fetch field defs for its type (+ global)
            if (itemRes.ok) {
                const it = await itemRes.json();
                const typeParam = it.itemTypeId ? `?itemTypeId=${it.itemTypeId}` : "";
                const defsRes = await fetch(`/api/custom-fields${typeParam}`);
                if (defsRes.ok) setCustomFieldDefs(await defsRes.json());
            }
        } catch (err) {
            console.error("Failed to fetch custom fields:", err);
        }
    };

    const saveCustomFieldValue = async (fieldId: string) => {
        setCfSaving(fieldId);
        try {
            const res = await fetch(`/api/configuration-items/${itemId}/custom-fields`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ values: { [fieldId]: cfEdits[fieldId] ?? "" } }),
            });
            if (res.ok) {
                await fetchCustomFields();
            } else {
                const err = await res.json().catch(() => ({}));
                addToast({ type: "error", title: "Could not save field", message: err.error || "Failed to save custom field value" });
            }
        } catch (err) {
            console.error("Failed to save custom field value:", err);
        }
        setCfSaving(null);
    };

    const fetchHistory = async () => {
        try {
            // Fetch audit logs for this specific item
            const res = await fetch(`/api/audit-logs?entityType=ConfigurationItem&entityId=${itemId}&limit=50`);
            if (res.ok) {
                const data = await res.json();
                // The API answers { logs, ... }; tolerate a bare array too.
                setHistory(Array.isArray(data) ? data : Array.isArray(data?.logs) ? data.logs : []);
            }
        } catch (err) {
            console.error("Failed to fetch history:", err);
        }
    };

    const deleteItem = async () => {
        try {
            const res = await fetch(`/api/configuration-items/${itemId}`, {
                method: "DELETE",
            });
            if (res.ok) {
                router.push("/items");
            } else {
                alert("Failed to delete asset");
            }
        } catch {
            alert("Network error");
        }
    };

    if (status === "loading" || loading) {
        return (
            <div className="space-y-4" role="status" aria-label="Loading asset">
                <Skeleton className="h-8 w-1/3" />
                <Skeleton className="h-4 w-1/4" />
                <Skeleton className="h-64 w-full" />
            </div>
        );
    }

    if (error || !item) {
        return (
            <EmptyState
                title={error || "Asset not found"}
                description="The asset could not be displayed."
                action={
                    <Link href="/items">
                        <Button variant="secondary">
                            <ArrowLeft className="size-4" aria-hidden="true" />
                            Back to Items
                        </Button>
                    </Link>
                }
            />
        );
    }

    const copyable = (label: string, value: string | undefined) => (
        <div className="min-w-0">
            <dt className="text-xs font-medium text-muted">{label}</dt>
            <dd className="mt-1 flex min-w-0 items-center gap-1 text-sm">
                {value ? (
                    <>
                        <span className="min-w-0 font-mono break-all text-text">{value}</span>
                        <CopyButton text={value} />
                    </>
                ) : (
                    <span className="text-muted">Not set</span>
                )}
            </dd>
        </div>
    );

    return (
        <div>
            <Link
                href="/items"
                className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-text max-sm:min-h-11"
            >
                <ArrowLeft className="size-4" aria-hidden="true" />
                Back to Items
            </Link>

            {/* Header */}
            <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-full flex-1 sm:min-w-0">
                    <h1 className="font-mono text-xl font-semibold break-all text-text">{item.name}</h1>
                    <div className="mt-2 flex flex-wrap items-center gap-3">
                        <StatusDot status={item.status} />
                        <Badge>{item.itemType?.name || "No type"}</Badge>
                    </div>
                    {item.description && (
                        <p className="mt-3 text-sm break-words text-muted">{item.description}</p>
                    )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <FavoriteButton itemId={item.id} itemName={item.name} />
                    <Link
                        href={`/items?id=${item.id}`}
                        className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-border-strong bg-surface px-4 text-sm font-medium whitespace-nowrap text-text transition-colors duration-150 hover:bg-surface-2 motion-reduce:transition-none max-sm:min-h-11"
                    >
                        <Pencil className="size-4" aria-hidden="true" />
                        Edit
                    </Link>
                    <Button variant="danger" onClick={() => setConfirmDelete(true)}>
                        <Trash2 className="size-4" aria-hidden="true" />
                        Delete
                    </Button>
                </div>
            </div>

            <div className="space-y-6">
                <Panel title="Details">
                    <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        {copyable("IP Address", item.ip)}
                        {copyable("MAC Address", item.mac)}
                        {copyable("ID", item.id)}
                        <div className="min-w-0">
                            <dt className="text-xs font-medium text-muted">Type</dt>
                            <dd className="mt-1 text-sm break-words text-text">{item.itemType?.name || "None"}</dd>
                        </div>
                        <div className="min-w-0">
                            <dt className="text-xs font-medium text-muted">Created</dt>
                            <dd className="mt-1 text-sm text-text">{formatDate(item.createdAt)}</dd>
                        </div>
                        <div className="min-w-0">
                            <dt className="text-xs font-medium text-muted">Updated</dt>
                            <dd className="mt-1 text-sm text-text">{formatTimeAgo(item.updatedAt)}</dd>
                        </div>
                        {item.user && (
                            <div className="min-w-0">
                                <dt className="text-xs font-medium text-muted">By</dt>
                                <dd className="mt-1 text-sm break-all text-text">{item.user.name || item.user.email}</dd>
                            </div>
                        )}
                    </dl>
                </Panel>

                <Panel title={`Tags (${item.tags.length})`}>
                    {item.tags.length === 0 ? (
                        <p className="text-sm text-muted">No tags.</p>
                    ) : (
                        <div className="flex flex-wrap gap-2">
                            {item.tags.map((tag) => (
                                <TagBadge key={tag.id} tag={tag} />
                            ))}
                        </div>
                    )}
                </Panel>

                <Panel title={`Custom Fields (${customFieldDefs.length})`}>
                    {customFieldDefs.length === 0 ? (
                        <div className="text-sm text-muted">
                            <p>No custom fields defined for this item type.</p>
                            <p className="mt-1">
                                Admins can create custom fields under{" "}
                                <a href="/admin/custom-fields" className="text-accent underline">
                                    Admin → Custom Fields
                                </a>.
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {customFieldDefs.map((field) => {
                                const inputId = `cf-${field.id}`;
                                const setValue = (v: string) => setCfEdits((prev) => ({ ...prev, [field.id]: v }));
                                return (
                                    <div key={field.id} className="flex flex-wrap items-end gap-3">
                                        <Field
                                            className="min-w-0 flex-1 basis-56"
                                            htmlFor={inputId}
                                            label={
                                                <>
                                                    {field.label}
                                                    {field.required && <span className="ml-1 text-danger" aria-hidden="true">*</span>}
                                                </>
                                            }
                                            hint={field.description || undefined}
                                        >
                                            {field.options?.length > 0 ? (
                                                <Select
                                                    id={inputId}
                                                    value={cfEdits[field.id] ?? ""}
                                                    onValueChange={setValue}
                                                    options={[
                                                        { value: "", label: "— select —" },
                                                        ...field.options.map((o) => ({ value: o, label: o })),
                                                    ]}
                                                />
                                            ) : field.type === "BOOLEAN" ? (
                                                <Select
                                                    id={inputId}
                                                    value={cfEdits[field.id] ?? ""}
                                                    onValueChange={setValue}
                                                    options={[
                                                        { value: "", label: "— select —" },
                                                        { value: "true", label: "Yes" },
                                                        { value: "false", label: "No" },
                                                    ]}
                                                />
                                            ) : (
                                                <Input
                                                    id={inputId}
                                                    type={field.type === "DATE" ? "date" : field.type === "NUMBER" ? "number" : field.type === "EMAIL" ? "email" : field.type === "URL" ? "url" : "text"}
                                                    value={cfEdits[field.id] ?? ""}
                                                    onChange={(e) => setValue(e.target.value)}
                                                    placeholder={field.defaultValue || ""}
                                                />
                                            )}
                                        </Field>
                                        <Button
                                            size="sm"
                                            onClick={() => saveCustomFieldValue(field.id)}
                                            loading={cfSaving === field.id}
                                            className="mb-0.5"
                                        >
                                            {cfSaving === field.id ? "Saving…" : "Save"}
                                        </Button>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </Panel>

                <Panel title="Relations">
                    <AssetRelations itemId={item.id} itemName={item.name} />
                </Panel>

                <Panel title={`Change History (${history.length})`}>
                    {history.length === 0 ? (
                        <p className="text-sm text-muted">No history available for this asset.</p>
                    ) : (
                        <ol className="space-y-4">
                            {history.map((entry) => (
                                <li key={entry.id} className="border-l-2 border-border pl-4">
                                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                                        <Badge tone={auditAction(entry.action).tone}>{auditAction(entry.action).label}</Badge>
                                        <span className="text-xs text-muted">{formatTimeAgo(entry.createdAt)}</span>
                                        {entry.user && (
                                            <span className="text-xs break-all text-muted">
                                                by {entry.user.name || entry.user.email}
                                            </span>
                                        )}
                                    </div>
                                    <p className="mt-1 text-sm break-words text-text">
                                        {entry.description || `${entry.action} Configuration Item`}
                                    </p>
                                    {(entry.oldValues || entry.newValues) && (
                                        <div className="mt-2 space-y-1 text-xs">
                                            {entry.oldValues && (
                                                <div className="font-mono break-all text-muted">
                                                    <span className="font-sans font-medium text-text">Old:</span> {entry.oldValues}
                                                </div>
                                            )}
                                            {entry.newValues && (
                                                <div className="font-mono break-all text-muted">
                                                    <span className="font-sans font-medium text-text">New:</span> {entry.newValues}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </li>
                            ))}
                        </ol>
                    )}
                </Panel>
            </div>

            <ConfirmDialog
                open={confirmDelete}
                onOpenChange={setConfirmDelete}
                title="Delete asset"
                description="Are you sure you want to delete this asset?"
                confirmLabel="Delete"
                tone="danger"
                onConfirm={deleteItem}
            />
        </div>
    );
}
