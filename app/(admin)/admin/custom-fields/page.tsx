"use client";

import { useState, useEffect } from "react";
import { ListChecks, Plus } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
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

const FIELD_TYPES = [
    { value: "STRING", label: "Text (String)" },
    { value: "NUMBER", label: "Number" },
    { value: "BOOLEAN", label: "Boolean (Yes/No)" },
    { value: "DATE", label: "Date" },
    { value: "URL", label: "URL / Link" },
    { value: "EMAIL", label: "Email" },
];

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
    const [fieldToDelete, setFieldToDelete] = useState<CustomField | null>(null);
    const [fieldToDeleteOpen, setFieldToDeleteOpen] = useState(false);
    const [msg, setMsg]             = useState<{ ok: boolean; text: string } | null>(null);

    async function fetchData() {
        const [fRes, tRes] = await Promise.all([
            fetch("/api/custom-fields"),
            fetch("/api/types"),
        ]);
        if (fRes.ok) setFields(await fRes.json());
        if (tRes.ok) setTypes(await tRes.json());
        setLoading(false);
    }

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        fetchData();
    }, []);
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
            <PageHeader
                title="Custom fields"
                description="Define extra metadata fields for your Configuration Items."
                actions={
                    <Button onClick={() => { setShowForm(v => !v); setMsg(null); }} variant={showForm ? "secondary" : "primary"}>
                        {showForm ? "Cancel" : (<><Plus className="size-4" aria-hidden="true" /> New Field</>)}
                    </Button>
                }
            />

            {msg && (
                <p
                    role="status"
                    className={`mb-6 rounded-md border p-3 text-sm ${msg.ok ? "border-success/40 bg-success/10 text-text" : "border-danger/40 bg-danger/10 text-danger"}`}
                >
                    {msg.text}
                </p>
            )}

            {showForm && (
                <form onSubmit={createField} className="mb-6">
                    <Panel title="New custom field">
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                            <Field label="Label *" htmlFor="cf-label">
                                <Input
                                    id="cf-label"
                                    required
                                    value={form.label}
                                    onChange={e => {
                                        const label = e.target.value;
                                        // Auto-fill machine name
                                        const name = label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
                                        setForm(f => ({ ...f, label, name }));
                                    }}
                                    placeholder="e.g. Purchase Date"
                                />
                            </Field>
                            <Field label="Machine name *" htmlFor="cf-name" hint="snake_case, auto-filled from label">
                                <Input
                                    id="cf-name"
                                    required
                                    value={form.name}
                                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                                    placeholder="e.g. purchase_date"
                                    className="font-mono"
                                />
                            </Field>
                            <Field label="Field type *" htmlFor="cf-type">
                                <Select
                                    id="cf-type"
                                    value={form.type}
                                    onValueChange={type => setForm(f => ({ ...f, type }))}
                                    options={FIELD_TYPES}
                                />
                            </Field>
                            <Field label="Item type scope" htmlFor="cf-scope">
                                <Select
                                    id="cf-scope"
                                    value={form.itemTypeId}
                                    onValueChange={itemTypeId => setForm(f => ({ ...f, itemTypeId }))}
                                    options={[
                                        { value: "", label: "Global (all item types)" },
                                        ...types.map(t => ({ value: t.id, label: t.name })),
                                    ]}
                                />
                            </Field>
                            <Field label="Description" htmlFor="cf-description" className="md:col-span-2">
                                <Input
                                    id="cf-description"
                                    value={form.description}
                                    onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                                    placeholder="Optional hint for users"
                                />
                            </Field>
                            <Field label="Default value" htmlFor="cf-default">
                                <Input
                                    id="cf-default"
                                    value={form.defaultValue}
                                    onChange={e => setForm(f => ({ ...f, defaultValue: e.target.value }))}
                                    placeholder="Optional"
                                />
                            </Field>
                            {form.type === "STRING" && (
                                <Field label="Options (comma-separated)" htmlFor="cf-options" hint="Leave empty for free-text">
                                    <Input
                                        id="cf-options"
                                        value={form.optionsRaw}
                                        onChange={e => setForm(f => ({ ...f, optionsRaw: e.target.value }))}
                                        placeholder="e.g. Option A, Option B"
                                    />
                                </Field>
                            )}
                            <label htmlFor="required" className="flex min-h-9 cursor-pointer items-center gap-2 text-sm font-medium text-text max-sm:min-h-11 md:pt-6">
                                <Checkbox
                                    id="required"
                                    checked={form.required}
                                    onCheckedChange={v => setForm(f => ({ ...f, required: v === true }))}
                                />
                                Required field
                            </label>
                        </div>
                        <div className="mt-6 flex gap-2">
                            <Button type="submit" disabled={saving}>
                                {saving ? "Creating..." : "Create Field"}
                            </Button>
                            <Button type="button" variant="secondary" onClick={() => setShowForm(false)}>Cancel</Button>
                        </div>
                    </Panel>
                </form>
            )}

            <div className="mb-4 flex flex-wrap items-center gap-3">
                <label htmlFor="cf-filter" className="text-sm font-medium text-text">Filter by scope:</label>
                <div className="w-56 max-w-full">
                    <Select
                        id="cf-filter"
                        value={filterType}
                        onValueChange={setFilterType}
                        options={[
                            { value: "", label: "All" },
                            { value: "__global__", label: "Global only" },
                            ...types.map(t => ({ value: t.id, label: t.name })),
                        ]}
                    />
                </div>
                <span className="font-mono text-sm text-muted">{displayed.length} field(s)</span>
            </div>

            {loading ? (
                <SkeletonTable rows={3} />
            ) : displayed.length === 0 ? (
                <EmptyState
                    icon={ListChecks}
                    title="No custom fields defined yet."
                    description='Click "New Field" to create one.'
                />
            ) : (
                <Table>
                    <THead>
                        <tr>
                            <TH>Label / Name</TH>
                            <TH>Type</TH>
                            <TH>Scope</TH>
                            <TH>Required</TH>
                            <TH>Options</TH>
                            <TH>Default</TH>
                            <TH className="relative"><span className="sr-only">Actions</span></TH>
                        </tr>
                    </THead>
                    <TBody>
                        {displayed.map(field => (
                            <TR key={field.id}>
                                <TD>
                                    <div className="font-medium">{field.label}</div>
                                    <div className="font-mono text-xs text-muted">{field.name}</div>
                                    {field.description && (
                                        <div className="mt-0.5 text-xs text-muted">{field.description}</div>
                                    )}
                                </TD>
                                <TD><Badge>{field.type}</Badge></TD>
                                <TD>
                                    {field.itemType ? <Badge tone="accent">{field.itemType.name}</Badge> : <span className="text-xs text-muted">Global</span>}
                                </TD>
                                <TD>{field.required ? <span className="font-medium">Yes</span> : <span className="text-muted">No</span>}</TD>
                                <TD className="text-xs text-muted">
                                    {field.options?.length ? field.options.join(", ") : "—"}
                                </TD>
                                <TD mono className="text-xs break-all">
                                    {field.defaultValue ?? <span className="text-muted">—</span>}
                                </TD>
                                <TD>
                                    <div className="flex justify-end">
                                        <Button
                                            variant="danger"
                                            size="sm"
                                            disabled={deleting === field.id}
                                            onClick={() => { setFieldToDelete(field); setFieldToDeleteOpen(true); }}
                                        >
                                            {deleting === field.id ? "…" : "Delete"}
                                        </Button>
                                    </div>
                                </TD>
                            </TR>
                        ))}
                    </TBody>
                </Table>
            )}

            <ConfirmDialog
                open={fieldToDeleteOpen}
                onOpenChange={setFieldToDeleteOpen}
                title="Delete custom field"
                description={`Delete custom field "${fieldToDelete?.label ?? ""}"? All stored values will be lost!`}
                confirmLabel="Delete"
                tone="danger"
                onConfirm={() => fieldToDelete && deleteField(fieldToDelete.id, fieldToDelete.label)}
            />
        </div>
    );
}
