'use client';

import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/Button';


export default function TypesPage() {
    const [types, setTypes] = useState([]);
    const [newType, setNewType] = useState({ name: '', description: '' });
    const [editingTypeId, setEditingTypeId] = useState(null);
    const [editingTypeData, setEditingTypeData] = useState({ name: '', description: '' });

    // Fetch the available types when the component mounts
    useEffect(() => {
        fetchTypes();
    }, []);

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

    const deleteType = async (id) => {
        await fetch(`/api/types/${id}`, { method: 'DELETE' });
        setTypes((prev) => prev.filter((t) => t.id !== id));
    };

    const startEditing = (type) => {
        setEditingTypeId(type.id);
        setEditingTypeData({ name: type.name, description: type.description || '' });
    };

    const cancelEditing = () => {
        setEditingTypeId(null);
        setEditingTypeData({ name: '', description: '' });
    };

    const updateType = async (id) => {
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
        <div className="min-h-screen bg-gray-100">

            {/* Main Content */}
            <main className="max-w-7xl mx-auto p-6">
                <h1 className="text-3xl font-bold mb-6">Configuration Item Types</h1>

                {/* New Type Form */}
                <div className="bg-white p-4 rounded-sm shadow-sm mb-6">
                    <h2 className="text-xl font-semibold mb-4">Add New Type</h2>
                    <div className="flex flex-col gap-4">
                        <input
                            type="text"
                            placeholder="Name"
                            value={newType.name}
                            onChange={(e) => setNewType({ ...newType, name: e.target.value })}
                            className="border rounded-sm p-2 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                        />
                        <input
                            type="text"
                            placeholder="Description"
                            value={newType.description}
                            onChange={(e) =>
                                setNewType({ ...newType, description: e.target.value })
                            }
                            className="border rounded-sm p-2 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                        />
                        <Button onClick={createType}>Add Type</Button>
                    </div>
                </div>

                {/* Types List */}
                <div className="bg-white p-4 rounded-sm shadow-sm">
                    <h2 className="text-xl font-semibold mb-4">Existing Types</h2>
                    <ul className="space-y-4">
                        {types.map((type) => (
                            <li
                                key={type.id}
                                className="border rounded-sm p-4 flex justify-between items-center"
                            >
                                {editingTypeId === type.id ? (
                                    <div className="flex-1">
                                        <input
                                            type="text"
                                            placeholder="Name"
                                            value={editingTypeData.name}
                                            onChange={(e) =>
                                                setEditingTypeData({
                                                    ...editingTypeData,
                                                    name: e.target.value,
                                                })
                                            }
                                            className="border rounded-sm p-2 mr-2 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                                        />
                                        <input
                                            type="text"
                                            placeholder="Description"
                                            value={editingTypeData.description}
                                            onChange={(e) =>
                                                setEditingTypeData({
                                                    ...editingTypeData,
                                                    description: e.target.value,
                                                })
                                            }
                                            className="border rounded-sm p-2 mr-2 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                                        />
                                    </div>
                                ) : (
                                    <div className="flex-1">
                                        <h3 className="font-bold text-lg">{type.name}</h3>
                                        <p className="text-gray-600">{type.description}</p>
                                    </div>
                                )}
                                <div className="flex gap-2">
                                    {editingTypeId === type.id ? (
                                        <>
                                            <Button onClick={() => updateType(type.id)}>Save</Button>
                                            <Button onClick={cancelEditing} variant="outline">
                                                Cancel
                                            </Button>
                                        </>
                                    ) : (
                                        <>
                                            <Button onClick={() => startEditing(type)}>Edit</Button>
                                            <Button
                                                onClick={() => deleteType(type.id)}
                                                variant="destructive"
                                            >
                                                Delete
                                            </Button>
                                        </>
                                    )}
                                </div>
                            </li>
                        ))}
                    </ul>
                </div>
            </main>
        </div>
    );
}
