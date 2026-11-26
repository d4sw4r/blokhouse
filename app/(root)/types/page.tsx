'use client';

import { useEffect, useState } from 'react';
import { Shapes } from 'lucide-react';

import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Field } from '@/components/ui/Field';
import { Input } from '@/components/ui/Input';
import { PageHeader } from '@/components/ui/PageHeader';
import { Panel } from '@/components/ui/Panel';
import { SkeletonTable } from '@/components/Skeleton';

interface ItemType {
    id: string;
    name: string;
    description?: string | null;
}

export default function TypesPage() {
    const [types, setTypes] = useState<ItemType[]>([]);
    const [loading, setLoading] = useState(true);
    const [newType, setNewType] = useState({ name: '', description: '' });
    const [editingTypeId, setEditingTypeId] = useState<string | null>(null);
    const [editingTypeData, setEditingTypeData] = useState({ name: '', description: '' });

    const fetchTypes = async () => {
        try {
            const res = await fetch('/api/types');
            const data = await res.json();
            if (Array.isArray(data)) {
                setTypes(data);
            } else {
                console.error('Unexpected response:', data);
                setTypes([]);
            }
        } catch (error) {
            console.error('Error fetching types:', error);
        }
    };

    // Fetch the available types when the component mounts
    useEffect(() => {
        const load = async () => { await fetchTypes(); setLoading(false); };
        load();
    }, []);

    const createType = async () => {
        const res = await fetch('/api/types', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newType),
        });
        const created = await res.json();
        setTypes((prev) => [...prev, created]);
        setNewType({ name: '', description: '' });
    };

    const deleteType = async (id: string) => {
        await fetch(`/api/types/${id}`, { method: 'DELETE' });
        setTypes((prev) => prev.filter((t) => t.id !== id));
    };

    const startEditing = (type: ItemType) => {
        setEditingTypeId(type.id);
        setEditingTypeData({ name: type.name, description: type.description || '' });
    };

    const cancelEditing = () => {
        setEditingTypeId(null);
        setEditingTypeData({ name: '', description: '' });
    };

    const updateType = async (id: string) => {
        const res = await fetch(`/api/types/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(editingTypeData),
        });
        const updated = await res.json();
        setTypes((prev) => prev.map((t) => (t.id === id ? updated : t)));
        cancelEditing();
    };

    return (
        <div>
            <PageHeader
                title="Configuration Item Types"
                description="The categories that configuration items are grouped under."
            />

            <Panel title="Add New Type" className="mb-6">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_2fr_auto] sm:items-end">
                    <Field label="Name" htmlFor="new-type-name">
                        <Input
                            id="new-type-name"
                            type="text"
                            placeholder="Name"
                            value={newType.name}
                            onChange={(e) => setNewType({ ...newType, name: e.target.value })}
                        />
                    </Field>
                    <Field label="Description" htmlFor="new-type-description">
                        <Input
                            id="new-type-description"
                            type="text"
                            placeholder="Description"
                            value={newType.description}
                            onChange={(e) => setNewType({ ...newType, description: e.target.value })}
                        />
                    </Field>
                    <Button onClick={createType}>Add Type</Button>
                </div>
            </Panel>

            <Panel title="Existing Types" padded={false}>
                {loading ? (
                    <div className="p-4"><SkeletonTable rows={3} /></div>
                ) : types.length === 0 ? (
                    <div className="p-4">
                        <EmptyState
                            icon={Shapes}
                            title="No types yet"
                            description="Add a type above to categorise your configuration items."
                        />
                    </div>
                ) : (
                    <ul className="divide-y divide-border">
                        {types.map((type) => (
                            <li
                                key={type.id}
                                className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
                            >
                                {editingTypeId === type.id ? (
                                    <div className="grid min-w-0 flex-1 grid-cols-1 gap-3 sm:grid-cols-2">
                                        <Input
                                            type="text"
                                            aria-label="Type name"
                                            placeholder="Name"
                                            value={editingTypeData.name}
                                            onChange={(e) =>
                                                setEditingTypeData({ ...editingTypeData, name: e.target.value })
                                            }
                                        />
                                        <Input
                                            type="text"
                                            aria-label="Type description"
                                            placeholder="Description"
                                            value={editingTypeData.description}
                                            onChange={(e) =>
                                                setEditingTypeData({ ...editingTypeData, description: e.target.value })
                                            }
                                        />
                                    </div>
                                ) : (
                                    <div className="min-w-0 flex-1">
                                        <h3 className="text-sm font-semibold break-words text-text">{type.name}</h3>
                                        {type.description && (
                                            <p className="mt-0.5 text-sm break-words text-muted">{type.description}</p>
                                        )}
                                    </div>
                                )}
                                <div className="flex shrink-0 gap-2">
                                    {editingTypeId === type.id ? (
                                        <>
                                            <Button size="sm" onClick={() => updateType(type.id)}>Save</Button>
                                            <Button size="sm" onClick={cancelEditing} variant="secondary">
                                                Cancel
                                            </Button>
                                        </>
                                    ) : (
                                        <>
                                            <Button size="sm" variant="secondary" onClick={() => startEditing(type)}>
                                                Edit
                                            </Button>
                                            <Button size="sm" variant="danger" onClick={() => deleteType(type.id)}>
                                                Delete
                                            </Button>
                                        </>
                                    )}
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </Panel>
        </div>
    );
}
