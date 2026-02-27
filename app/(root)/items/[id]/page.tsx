// app/(root)/items/[id]/page.tsx
"use client";

import { useSession } from "next-auth/react";
import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import Link from "next/link";
import AssetRelations from "@/components/AssetRelations";

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

interface CustomFieldValue {
    id: string;
    value: string;
    customFieldId: string;
    customField: CustomField;
}

const statusColors: Record<AssetStatus, string> = {
    ACTIVE: "bg-green-100 text-green-800 border-green-200",
    DEPRECATED: "bg-red-100 text-red-800 border-red-200",
    MAINTENANCE: "bg-yellow-100 text-yellow-800 border-yellow-200",
};

const statusLabels: Record<AssetStatus, string> = {
    ACTIVE: "Active",
    DEPRECATED: "Deprecated",
    MAINTENANCE: "Maintenance",
};

const actionColors: Record<string, string> = {
    CREATE: "bg-blue-100 text-blue-800",
    UPDATE: "bg-yellow-100 text-yellow-800",
    DELETE: "bg-red-100 text-red-800",
};

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
    const { data: session, status } = useSession();
    const params = useParams();
    const router = useRouter();
    const itemId = params.id as string;

    const [item, setItem] = useState<ConfigItem | null>(null);
    const [history, setHistory] = useState<AuditLogEntry[]>([]);
    const [customFieldValues, setCustomFieldValues] = useState<CustomFieldValue[]>([]);
    const [customFieldDefs, setCustomFieldDefs] = useState<CustomField[]>([]);
    const [cfEdits, setCfEdits] = useState<Record<string, string>>({});
    const [cfSaving, setCfSaving] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<"overview" | "relations" | "history" | "fields">("overview");

    useEffect(() => {
        if (status === "authenticated" && itemId) {
            fetchItem();
            fetchHistory();
            fetchCustomFields();
        }
    }, [status, itemId]);

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
        } catch (err) {
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
                const vals: CustomFieldValue[] = await valRes.json();
                setCustomFieldValues(vals);
                // Build edits map from existing values
                const edits: Record<string, string> = {};
                vals.forEach(v => { edits[v.customFieldId] = v.value; });
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
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ customFieldId: fieldId, value: cfEdits[fieldId] ?? "" }),
            });
            if (res.ok) await fetchCustomFields();
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
                setHistory(data);
            }
        } catch (err) {
            console.error("Failed to fetch history:", err);
        }
    };

    const deleteItem = async () => {
        if (!confirm("Are you sure you want to delete this asset?")) return;
        try {
            const res = await fetch(`/api/configuration-items/${itemId}`, {
                method: "DELETE",
            });
            if (res.ok) {
                router.push("/items");
            } else {
                alert("Failed to delete asset");
            }
        } catch (err) {
            alert("Network error");
        }
    };

    if (status === "loading" || loading) {
        return (
            <div className="min-h-screen bg-gray-50 p-8">
                <div className="max-w-5xl mx-auto">
                    <div className="animate-pulse">
                        <div className="h-8 bg-gray-300 rounded w-1/3 mb-4"></div>
                        <div className="h-4 bg-gray-300 rounded w-1/4 mb-8"></div>
                        <div className="h-64 bg-gray-300 rounded"></div>
                    </div>
                </div>
            </div>
        );
    }

    if (error || !item) {
        return (
            <div className="min-h-screen bg-gray-50 p-8">
                <div className="max-w-5xl mx-auto">
                    <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
                        <h2 className="text-xl font-semibold text-red-800 mb-2">Error</h2>
                        <p className="text-red-600">{error || "Asset not found"}</p>
                        <Link href="/items">
                            <Button className="mt-4">← Back to Items</Button>
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">
            <main className="max-w-5xl mx-auto p-8">
                {/* Header */}
                <div className="mb-6">
                    <Link href="/items" className="text-brand-primary hover:underline text-sm">
                        ← Back to Items
                    </Link>
                </div>

                {/* Asset Header */}
                <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
                    <div className="flex justify-between items-start">
                        <div>
                            <div className="flex items-center gap-3 mb-2">
                                <h1 className="text-3xl font-bold text-gray-900">{item.name}</h1>
                                <span className={`px-3 py-1 rounded-full text-sm font-medium border ${statusColors[item.status]}`}>
                                    {statusLabels[item.status]}
                                </span>
                            </div>
                            {item.description && (
                                <p className="text-gray-600 text-lg">{item.description}</p>
                            )}
                        </div>
                        <div className="flex gap-2">
                            <Link href={`/items?id=${item.id}`}>
                                <Button variant="outline">Edit</Button>
                            </Link>
                            <Button variant="destructive" onClick={deleteItem}>Delete</Button>
                        </div>
                    </div>

                    {/* Metadata */}
                    <div className="mt-6 flex flex-wrap gap-4 text-sm text-gray-500">
                        <span>ID: <code className="bg-gray-100 px-1 rounded">{item.id}</code></span>
                        <span>Type: {item.itemType?.name || "None"}</span>
                        <span>Created: {formatDate(item.createdAt)}</span>
                        <span>Updated: {formatTimeAgo(item.updatedAt)}</span>
                        {item.user && (
                            <span>By: {item.user.name || item.user.email}</span>
                        )}
                    </div>

                    {/* Tags */}
                    {item.tags.length > 0 && (
                        <div className="mt-4 flex flex-wrap gap-2">
                            {item.tags.map((tag) => (
                                <span
                                    key={tag.id}
                                    className="px-3 py-1 rounded-full text-sm"
                                    style={{
                                        backgroundColor: tag.color ? `${tag.color}30` : '#e5e7eb',
                                        border: `1px solid ${tag.color || '#d1d5db'}`,
                                        color: tag.color || '#374151',
                                    }}
                                >
                                    {tag.name}
                                </span>
                            ))}
                        </div>
                    )}
                </div>

                {/* Tabs */}
                <div className="bg-white rounded-lg shadow-sm mb-6">
                    <div className="border-b border-gray-200">
                        <nav className="flex">
                            <button
                                onClick={() => setActiveTab("overview")}
                                className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                                    activeTab === "overview"
                                        ? "border-brand-primary text-brand-primary"
                                        : "border-transparent text-gray-500 hover:text-gray-700"
                                }`}
                            >
                                Overview
                            </button>
                            <button
                                onClick={() => setActiveTab("relations")}
                                className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                                    activeTab === "relations"
                                        ? "border-brand-primary text-brand-primary"
                                        : "border-transparent text-gray-500 hover:text-gray-700"
                                }`}
                            >
                                Relations
                            </button>
                            <button
                                onClick={() => setActiveTab("history")}
                                className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                                    activeTab === "history"
                                        ? "border-brand-primary text-brand-primary"
                                        : "border-transparent text-gray-500 hover:text-gray-700"
                                }`}
                            >
                                History ({history.length})
                            </button>
                            <button
                                onClick={() => setActiveTab("fields")}
                                className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                                    activeTab === "fields"
                                        ? "border-brand-primary text-brand-primary"
                                        : "border-transparent text-gray-500 hover:text-gray-700"
                                }`}
                            >
                                Custom Fields ({customFieldDefs.length})
                            </button>
                        </nav>
                    </div>

                    <div className="p-6">
                        {activeTab === "overview" && (
                            <div className="space-y-6">
                                {/* Network Info */}
                                <section>
                                    <h3 className="text-lg font-semibold text-gray-800 mb-4">Network Information</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="bg-gray-50 rounded-lg p-4">
                                            <span className="text-sm text-gray-500">IP Address</span>
                                            <div className="mt-1">
                                                {item.ip ? (
                                                    <code className="text-lg font-mono bg-gray-200 px-2 py-1 rounded">{item.ip}</code>
                                                ) : (
                                                    <span className="text-gray-400 italic">Not set</span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="bg-gray-50 rounded-lg p-4">
                                            <span className="text-sm text-gray-500">MAC Address</span>
                                            <div className="mt-1">
                                                {item.mac ? (
                                                    <code className="text-lg font-mono bg-gray-200 px-2 py-1 rounded">{item.mac}</code>
                                                ) : (
                                                    <span className="text-gray-400 italic">Not set</span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </section>

                                {/* Quick Stats */}
                                <section>
                                    <h3 className="text-lg font-semibold text-gray-800 mb-4">Quick Stats</h3>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                        <div className="bg-blue-50 rounded-lg p-4 text-center">
                                            <div className="text-2xl font-bold text-blue-600">{history.length}</div>
                                            <div className="text-sm text-blue-600">Changes</div>
                                        </div>
                                        <div className="bg-purple-50 rounded-lg p-4 text-center">
                                            <div className="text-2xl font-bold text-purple-600">{item.tags.length}</div>
                                            <div className="text-sm text-purple-600">Tags</div>
                                        </div>
                                    </div>
                                </section>
                            </div>
                        )}

                        {activeTab === "relations" && (
                            <AssetRelations itemId={item.id} itemName={item.name} />
                        )}

                        {activeTab === "history" && (
                            <div>
                                <h3 className="text-lg font-semibold text-gray-800 mb-4">Change History</h3>
                                {history.length === 0 ? (
                                    <div className="text-center py-8 text-gray-500">
                                        <p>No history available for this asset.</p>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        {history.map((entry) => (
                                            <div key={entry.id} className="border-l-4 border-gray-200 pl-4 py-2">
                                                <div className="flex items-center gap-3 mb-1">
                                                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${actionColors[entry.action] || "bg-gray-100 text-gray-800"}`}>
                                                        {entry.action}
                                                    </span>
                                                    <span className="text-sm text-gray-500">
                                                        {formatTimeAgo(entry.createdAt)}
                                                    </span>
                                                    {entry.user && (
                                                        <span className="text-sm text-gray-600">
                                                            by {entry.user.name || entry.user.email}
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-gray-800">{entry.description || `${entry.action} Configuration Item`}</p>
                                                {(entry.oldValues || entry.newValues) && (
                                                    <div className="mt-2 text-sm">
                                                        {entry.oldValues && (
                                                            <div className="text-red-600">
                                                                <span className="font-medium">Old:</span> {entry.oldValues}
                                                            </div>
                                                        )}
                                                        {entry.newValues && (
                                                            <div className="text-green-600">
                                                                <span className="font-medium">New:</span> {entry.newValues}
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {activeTab === "fields" && (
                            <div>
                                <h3 className="text-lg font-semibold text-gray-800 mb-4">Custom Fields</h3>
                                {customFieldDefs.length === 0 ? (
                                    <div className="text-center py-8 text-gray-400">
                                        <p>No custom fields defined for this item type.</p>
                                        <p className="text-sm mt-1">
                                            Admins can create custom fields under{" "}
                                            <a href="/admin/custom-fields" className="text-brand-primary hover:underline">
                                                Admin → Custom Fields
                                            </a>.
                                        </p>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        {customFieldDefs.map((field) => {
                                            const current = cfEdits[field.id] ?? customFieldValues.find(v => v.customFieldId === field.id)?.value ?? "";
                                            return (
                                                <div key={field.id} className="border border-gray-200 rounded-lg p-4">
                                                    <div className="flex items-start justify-between gap-4">
                                                        <div className="flex-1">
                                                            <label className="block text-sm font-semibold text-gray-700 mb-1">
                                                                {field.label}
                                                                {field.required && <span className="text-red-500 ml-1">*</span>}
                                                            </label>
                                                            {field.description && (
                                                                <p className="text-xs text-gray-400 mb-2">{field.description}</p>
                                                            )}
                                                            {field.options?.length > 0 ? (
                                                                <select
                                                                    value={cfEdits[field.id] ?? ""}
                                                                    onChange={e => setCfEdits(prev => ({ ...prev, [field.id]: e.target.value }))}
                                                                    className="w-full border rounded-sm p-2 text-sm"
                                                                >
                                                                    <option value="">— select —</option>
                                                                    {field.options.map(o => (
                                                                        <option key={o} value={o}>{o}</option>
                                                                    ))}
                                                                </select>
                                                            ) : field.type === "BOOLEAN" ? (
                                                                <select
                                                                    value={cfEdits[field.id] ?? ""}
                                                                    onChange={e => setCfEdits(prev => ({ ...prev, [field.id]: e.target.value }))}
                                                                    className="w-full border rounded-sm p-2 text-sm"
                                                                >
                                                                    <option value="">— select —</option>
                                                                    <option value="true">Yes</option>
                                                                    <option value="false">No</option>
                                                                </select>
                                                            ) : (
                                                                <input
                                                                    type={field.type === "DATE" ? "date" : field.type === "NUMBER" ? "number" : field.type === "EMAIL" ? "email" : field.type === "URL" ? "url" : "text"}
                                                                    value={cfEdits[field.id] ?? ""}
                                                                    onChange={e => setCfEdits(prev => ({ ...prev, [field.id]: e.target.value }))}
                                                                    placeholder={field.defaultValue || ""}
                                                                    className="w-full border rounded-sm p-2 text-sm"
                                                                />
                                                            )}
                                                        </div>
                                                        <Button
                                                            size="sm"
                                                            onClick={() => saveCustomFieldValue(field.id)}
                                                            disabled={cfSaving === field.id}
                                                        >
                                                            {cfSaving === field.id ? "Saving…" : "Save"}
                                                        </Button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
}
