"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/Button";

const FIELD_TYPES = [
    { value: "STRING", label: "Text (String)" },
    { value: "NUMBER", label: "Number" },
    { value: "BOOLEAN", label: "Boolean (Yes/No)" },
    { value: "DATE", label: "Date" },
    { value: "URL", label: "URL / Link" },
    { value: "EMAIL", label: "Email" },
];

const TYPE_BADGES: Record<string, string> = {
    STRING:  "bg-blue-100  text-blue-800",
    NUMBER:  "bg-purple-100 text-purple-800",
    BOOLEAN: "bg-green-100  text-green-800",
    DATE:    "bg-orange-100 text-orange-800",
    URL:     "bg-teal-100   text-teal-800",
    EMAIL:   "bg-pink-100   text-pink-800",
};

interface ItemType { id: string; name: string }
interface CustomField {
    id: string;
    name: string;
    label: string;
    description: string | null;
    type: string;
    required: boolean;
    defaultValue: string | null;
    options: string[];
    itemTypeId: string | null;
    itemType: ItemType | null;
    createdAt: string;
}

const empty = {
    name: "",
    label: "",
    description: "",
    type: "STRING",
    required: false,
    defaultValue: "",
    optionsRaw: "",   // comma-separated input
    itemTypeId: "",
};

export default function CustomFieldsAdminPage() {
    const [fields, setFields]       = useState<CustomField[]>([]);
    const [types,  setTypes]        = useState<ItemType[]>([]);
    const [loading, setLoading]     = useState(true);
    const [saving,  setSaving]      = useState(false);
    const [deleting, setDeleting]   = useState<string | null>(null);
    const [showForm, setShowForm]   = useState(false);
    const [form, setForm]           = useState(empty);
    const [filterType, setFilterType] = useState<string>("");
    const [msg, setMsg]             = useState<{ ok: boolean; text: string } | null>(null);

    useEffect(() => {
        fetchData();
    }, []);

    async function fetchData() {
        setLoading(true);
        const [fRes, tRes] = await Promise.all([
            fetch("/api/custom-fields"),
            fetch("/api/types"),
        ]);
        if (fRes.ok) setFields(await fRes.json());
        if (tRes.ok) setTypes(await tRes.json());
        setLoading(false);
    }

    async function createField(e: React.FormEvent) {
        e.preventDefault();
        setSaving(true);
        setMsg(null);

        const options = form.optionsRaw
            .split(",")
            .map(s => s.trim())
            .filter(Boolean);

        const res = await fetch("/api/custom-fields", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                name:         form.name,
                label:        form.label,
                description:  form.description || undefined,
                type:         form.type,
                required:     form.required,
                defaultValue: form.defaultValue || undefined,
                options:      options.length ? options : undefined,
                itemTypeId:   form.itemTypeId || undefined,
            }),
        });

        if (res.ok) {
            setMsg({ ok: true, text: "Custom field created!" });
            setForm(empty);
            setShowForm(false);
            await fetchData();
        } else {
            const err = await res.json();
            setMsg({ ok: false, text: err.error || "Failed to create field" });
        }
        setSaving(false);
    }

    async function deleteField(id: string, label: string) {
        if (!confirm(`Delete custom field "${label}"? All stored values will be lost!`)) return;
        setDeleting(id);
        const res = await fetch(`/api/custom-fields/${id}`, { method: "DELETE" });
        if (res.ok) {
            setFields(prev => prev.filter(f => f.id !== id));
            setMsg({ ok: true, text: `Deleted "${label}"` });
        } else {
            setMsg({ ok: false, text: "Delete failed" });
        }
        setDeleting(null);
    }

    const displayed = filterType
        ? fields.filter(f => f.itemTypeId === filterType || f.itemTypeId === null)
        : fields;

    return (
        <div>
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-3xl font-bold text-gray-800">Custom Fields</h1>
                    <p className="text-gray-500 mt-1">Define extra metadata fields for your Configuration Items.</p>
                </div>
                <Button onClick={() => { setShowForm(v => !v); setMsg(null); }}>
                    {showForm ? "Cancel" : "+ New Field"}
                </Button>
            </div>

            {/* Flash message */}
            {msg && (
                <div className={`mb-6 p-3 rounded-lg text-sm font-medium ${msg.ok ? "bg-green-50 text-green-800 border border-green-200" : "bg-red-50 text-red-800 border border-red-200"}`}>
                    {msg.text}
                </div>
            )}

            {/* Create form */}
            {showForm && (
                <form onSubmit={createField} className="bg-white rounded-lg shadow-sm p-6 mb-8 border border-brand-primary/20">
                    <h2 className="text-lg font-semibold text-gray-800 mb-4">New Custom Field</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Label */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Label <span className="text-red-500">*</span></label>
                            <input
                                required
                                value={form.label}
                                onChange={e => {
                                    const label = e.target.value;
                                    // Auto-fill machine name
                                    const name = label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
                                    setForm(f => ({ ...f, label, name }));
                                }}
                                placeholder="e.g. Purchase Date"
                                className="w-full border rounded-sm p-2"
                            />
                        </div>
                        {/* Machine name */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Machine Name <span className="text-red-500">*</span></label>
                            <input
                                required
                                value={form.name}
                                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                                placeholder="e.g. purchase_date"
                                className="w-full border rounded-sm p-2 font-mono text-sm"
                            />
                            <p className="text-xs text-gray-400 mt-0.5">snake_case, auto-filled from label</p>
                        </div>
                        {/* Type */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Field Type <span className="text-red-500">*</span></label>
                            <select
                                value={form.type}
                                onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
                                className="w-full border rounded-sm p-2"
                            >
                                {FIELD_TYPES.map(t => (
                                    <option key={t.value} value={t.value}>{t.label}</option>
                                ))}
                            </select>
                        </div>
                        {/* Scope */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Item Type Scope</label>
                            <select
                                value={form.itemTypeId}
                                onChange={e => setForm(f => ({ ...f, itemTypeId: e.target.value }))}
                                className="w-full border rounded-sm p-2"
                            >
                                <option value="">Global (all item types)</option>
                                {types.map(t => (
                                    <option key={t.id} value={t.id}>{t.name}</option>
                                ))}
                            </select>
                        </div>
                        {/* Description */}
                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                            <input
                                value={form.description}
                                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                                placeholder="Optional hint for users"
                                className="w-full border rounded-sm p-2"
                            />
                        </div>
                        {/* Default value */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Default Value</label>
                            <input
                                value={form.defaultValue}
                                onChange={e => setForm(f => ({ ...f, defaultValue: e.target.value }))}
                                placeholder="Optional"
                                className="w-full border rounded-sm p-2"
                            />
                        </div>
                        {/* Options (STRING only) */}
                        {form.type === "STRING" && (
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Options (comma-separated)</label>
                                <input
                                    value={form.optionsRaw}
                                    onChange={e => setForm(f => ({ ...f, optionsRaw: e.target.value }))}
                                    placeholder="e.g. Option A, Option B"
                                    className="w-full border rounded-sm p-2"
                                />
                                <p className="text-xs text-gray-400 mt-0.5">Leave empty for free-text</p>
                            </div>
                        )}
                        {/* Required */}
                        <div className="flex items-center gap-2 pt-4">
                            <input
                                type="checkbox"
                                id="required"
                                checked={form.required}
                                onChange={e => setForm(f => ({ ...f, required: e.target.checked }))}
                                className="cursor-pointer"
                            />
                            <label htmlFor="required" className="text-sm font-medium text-gray-700 cursor-pointer">
                                Required field
                            </label>
                        </div>
                    </div>
                    <div className="mt-6 flex gap-2">
                        <Button type="submit" disabled={saving}>
                            {saving ? "Creating..." : "Create Field"}
                        </Button>
                        <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
                    </div>
                </form>
            )}

            {/* Filter */}
            <div className="mb-4 flex items-center gap-4">
                <label className="text-sm font-medium text-gray-600">Filter by scope:</label>
                <select
                    value={filterType}
                    onChange={e => setFilterType(e.target.value)}
                    className="border rounded-sm p-1.5 text-sm"
                >
                    <option value="">All</option>
                    <option value="__global__">Global only</option>
                    {types.map(t => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                </select>
                <span className="text-sm text-gray-500">{displayed.length} field(s)</span>
            </div>

            {/* Fields table */}
            {loading ? (
                <div className="animate-pulse space-y-3">
                    {[1,2,3].map(i => <div key={i} className="h-14 bg-gray-200 rounded" />)}
                </div>
            ) : displayed.length === 0 ? (
                <div className="text-center py-16 text-gray-400">
                    <p className="text-lg">No custom fields defined yet.</p>
                    <p className="text-sm mt-1">Click "+ New Field" to create one.</p>
                </div>
            ) : (
                <div className="bg-white rounded-lg shadow-sm overflow-hidden">
                    <table className="min-w-full">
                        <thead className="bg-gray-100 border-b">
                            <tr>
                                <th className="py-3 px-4 text-left text-sm font-semibold text-gray-700">Label / Name</th>
                                <th className="py-3 px-4 text-left text-sm font-semibold text-gray-700">Type</th>
                                <th className="py-3 px-4 text-left text-sm font-semibold text-gray-700">Scope</th>
                                <th className="py-3 px-4 text-left text-sm font-semibold text-gray-700">Required</th>
                                <th className="py-3 px-4 text-left text-sm font-semibold text-gray-700">Options</th>
                                <th className="py-3 px-4 text-left text-sm font-semibold text-gray-700">Default</th>
                                <th className="py-3 px-4 text-right text-sm font-semibold text-gray-700">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {displayed.map(field => (
                                <tr key={field.id} className="hover:bg-gray-50">
                                    <td className="py-3 px-4">
                                        <div className="font-medium text-gray-900">{field.label}</div>
                                        <div className="text-xs font-mono text-gray-400">{field.name}</div>
                                        {field.description && (
                                            <div className="text-xs text-gray-500 mt-0.5">{field.description}</div>
                                        )}
                                    </td>
                                    <td className="py-3 px-4">
                                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${TYPE_BADGES[field.type] || "bg-gray-100 text-gray-700"}`}>
                                            {field.type}
                                        </span>
                                    </td>
                                    <td className="py-3 px-4 text-sm text-gray-600">
                                        {field.itemType ? (
                                            <span className="bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded text-xs">{field.itemType.name}</span>
                                        ) : (
                                            <span className="text-gray-400 text-xs">Global</span>
                                        )}
                                    </td>
                                    <td className="py-3 px-4 text-sm">
                                        {field.required
                                            ? <span className="text-red-600 font-medium">Yes</span>
                                            : <span className="text-gray-400">No</span>}
                                    </td>
                                    <td className="py-3 px-4 text-xs text-gray-600">
                                        {field.options?.length
                                            ? field.options.join(", ")
                                            : <span className="text-gray-300">—</span>}
                                    </td>
                                    <td className="py-3 px-4 text-xs font-mono text-gray-500">
                                        {field.defaultValue ?? <span className="text-gray-300">—</span>}
                                    </td>
                                    <td className="py-3 px-4 text-right">
                                        <Button
                                            variant="destructive"
                                            size="sm"
                                            disabled={deleting === field.id}
                                            onClick={() => deleteField(field.id, field.label)}
                                        >
                                            {deleting === field.id ? "…" : "Delete"}
                                        </Button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
