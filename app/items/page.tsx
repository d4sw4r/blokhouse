'use client';

import { useSession } from "next-auth/react";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/Button";

interface ConfigItem {
    id: string;
    name: string;
    description?: string;
    ip?: string;
    mac?: string;
    itemTypeId?: string;
    itemType?: { id: string; name: string } | null;
}

interface Type {
    id: string;
    name: string;
}

export default function ItemsPage() {
    const { data: session, status } = useSession();
    const [items, setItems] = useState<ConfigItem[]>([]);
    const [availableTypes, setAvailableTypes] = useState<Type[]>([]);
    const [newItem, setNewItem] = useState({ name: "", description: "", itemTypeId: "", ip: "", mac: "" });
    const [editingItemId, setEditingItemId] = useState<string | null>(null);
    const [editingItemData, setEditingItemData] = useState({ name: "", description: "", ip: "", mac: "", itemTypeId: "" });

    useEffect(() => {
        if (session) {
            fetch("/api/configuration-items")
                .then(async (res) => {
                    if (!res.ok) {
                        console.error("API Error:", await res.text());
                        return [];
                    }
                    return res.json();
                })
                .then((data) => {
                    if (Array.isArray(data)) setItems(data);
                    else setItems([]);
                })
                .catch((err) => console.error("Fetch error:", err));
        }
    }, [session]);

    useEffect(() => {
        if (session) {
            fetch("/api/types")
                .then(async (res) => {
                    if (!res.ok) {
                        console.error("Types API Error:", await res.text());
                        return [];
                    }
                    return res.json();
                })
                .then((data) => {
                    if (Array.isArray(data)) setAvailableTypes(data);
                    else setAvailableTypes([]);
                })
                .catch((err) => console.error("Fetch types error:", err));
        }
    }, [session]);

    const createItem = async () => {
        const res = await fetch("/api/configuration-items", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(newItem),
        });
        const created = await res.json();
        setItems((prev) => [...prev, created]);
        setNewItem({ name: "", description: "", itemTypeId: "", ip: "", mac: "" });
    };

    const deleteItem = async (id: string) => {
        await fetch(`/api/configuration-items/${id}`, { method: "DELETE" });
        setItems((prev) => prev.filter((item) => item.id !== id));
    };

    const startEditing = (item: ConfigItem) => {
        setEditingItemId(item.id);
        setEditingItemData({
            name: item.name,
            description: item.description || "",
            ip: item.ip || "",
            mac: item.mac || "",
            itemTypeId: item.itemTypeId || "",
        });
    };

    const cancelEditing = () => {
        setEditingItemId(null);
        setEditingItemData({ name: "", description: "", ip: "", mac: "", itemTypeId: "" });
    };

    const updateItem = async (id: string) => {
        const res = await fetch(`/api/configuration-items/${id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(editingItemData),
        });
        const updated = await res.json();
        setItems((prev) => prev.map((item) => (item.id === id ? updated : item)));
        cancelEditing();
    };

    if (status === "loading") return <p className="p-6 text-lg">Loading...</p>;

    return (
        <div className="min-h-screen bg-gray-50">
            <main className="max-w-7xl mx-auto p-8">
                <h1 className="text-4xl font-bold text-gray-800 mb-8">Configuration Items</h1>

                {/* New Item Form */}
                <section className="bg-white p-6 rounded-lg shadow mb-10">
                    <h2 className="text-2xl font-semibold text-gray-700 mb-4">Add New Item</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <input
                            type="text"
                            placeholder="Name"
                            value={newItem.name}
                            onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                            className="border rounded p-2"
                        />
                        <input
                            type="text"
                            placeholder="Description"
                            value={newItem.description}
                            onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
                            className="border rounded p-2"
                        />
                        <input
                            type="text"
                            placeholder="IP Address"
                            value={newItem.ip}
                            onChange={(e) => setNewItem({ ...newItem, ip: e.target.value })}
                            className="border rounded p-2"
                        />
                        <input
                            type="text"
                            placeholder="MAC Address"
                            value={newItem.mac}
                            onChange={(e) => setNewItem({ ...newItem, mac: e.target.value })}
                            className="border rounded p-2"
                        />
                        <select
                            value={newItem.itemTypeId}
                            onChange={(e) => setNewItem({ ...newItem, itemTypeId: e.target.value })}
                            className="border rounded p-2"
                        >
                            <option value="">Select a type (optional)</option>
                            {availableTypes.map((type) => (
                                <option key={type.id} value={type.id}>
                                    {type.name}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="mt-4">
                        <Button onClick={createItem}>Add Item</Button>
                    </div>
                </section>

                {/* Items Table */}
                <section className="bg-white shadow rounded overflow-x-auto">
                    <table className="min-w-full">
                        <thead className="bg-gray-200">
                            <tr>
                                <th className="py-3 px-4 border">Name</th>
                                <th className="py-3 px-4 border">Description</th>
                                <th className="py-3 px-4 border">IP</th>
                                <th className="py-3 px-4 border">MAC</th>
                                <th className="py-3 px-4 border">Type</th>
                                <th className="py-3 px-4 border">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {items.map((item) =>
                                editingItemId === item.id ? (
                                    <tr key={item.id}>
                                        <td className="py-2 px-4 border">
                                            <input
                                                type="text"
                                                value={editingItemData.name}
                                                onChange={(e) =>
                                                    setEditingItemData({ ...editingItemData, name: e.target.value })
                                                }
                                                className="w-full border rounded p-1"
                                            />
                                        </td>
                                        <td className="py-2 px-4 border">
                                            <input
                                                type="text"
                                                value={editingItemData.description}
                                                onChange={(e) =>
                                                    setEditingItemData({ ...editingItemData, description: e.target.value })
                                                }
                                                className="w-full border rounded p-1"
                                            />
                                        </td>
                                        <td className="py-2 px-4 border">
                                            <input
                                                type="text"
                                                value={editingItemData.ip}
                                                onChange={(e) =>
                                                    setEditingItemData({ ...editingItemData, ip: e.target.value })
                                                }
                                                className="w-full border rounded p-1"
                                            />
                                        </td>
                                        <td className="py-2 px-4 border">
                                            <input
                                                type="text"
                                                value={editingItemData.mac}
                                                onChange={(e) =>
                                                    setEditingItemData({ ...editingItemData, mac: e.target.value })
                                                }
                                                className="w-full border rounded p-1"
                                            />
                                        </td>
                                        <td className="py-2 px-4 border">
                                            <select
                                                value={editingItemData.itemTypeId}
                                                onChange={(e) =>
                                                    setEditingItemData({ ...editingItemData, itemTypeId: e.target.value })
                                                }
                                                className="w-full border rounded p-1"
                                            >
                                                <option value="">None</option>
                                                {availableTypes.map((type) => (
                                                    <option key={type.id} value={type.id}>
                                                        {type.name}
                                                    </option>
                                                ))}
                                            </select>
                                        </td>
                                        <td className="py-2 px-4 border flex gap-2">
                                            <Button onClick={() => updateItem(item.id)}>Save</Button>
                                            <Button onClick={cancelEditing} variant="outline">Cancel</Button>
                                        </td>
                                    </tr>
                                ) : (
                                    <tr key={item.id}>
                                        <td className="py-2 px-4 border">{item.name}</td>
                                        <td className="py-2 px-4 border">{item.description}</td>
                                        <td className="py-2 px-4 border">{item.ip}</td>
                                        <td className="py-2 px-4 border">{item.mac}</td>
                                        <td className="py-2 px-4 border">{item.itemType ? item.itemType.name : "None"}</td>
                                        <td className="py-2 px-4 border flex gap-2">
                                            <Button onClick={() => startEditing(item)}>Edit</Button>
                                            <Button onClick={() => deleteItem(item.id)} variant="destructive">Delete</Button>
                                        </td>
                                    </tr>
                                )
                            )}
                        </tbody>
                    </table>
                </section>
            </main>
        </div>
    );
}
