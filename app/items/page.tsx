'use client';

import { useSession } from "next-auth/react";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/Button";

//
// Define a TypeScript interface for configuration items.
// Adjust the interface as needed based on your Prisma schema.
//
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

export default function Home() {
    const { data: session, status } = useSession();

    // State for the list of configuration items
    const [items, setItems] = useState<ConfigItem[]>([]);
    // State for available types (for the new item form and editing)
    const [availableTypes, setAvailableTypes] = useState<Type[]>([]);
    // State for the new configuration item form
    const [newItem, setNewItem] = useState<{
        name: string;
        description: string;
        itemTypeId: string;
        ip: string;
        mac: string;
    }>({
        name: "",
        description: "",
        itemTypeId: "",
        ip: "",
        mac: "",
    });
    // State for inline editing: store the id of the item being edited,
    // and its current editing values.
    const [editingItemId, setEditingItemId] = useState<string | null>(null);
    const [editingItemData, setEditingItemData] = useState<{
        name: string;
        description: string;
        ip: string;
        mac: string;
        itemTypeId: string;
    }>({
        name: "",
        description: "",
        ip: "",
        mac: "",
        itemTypeId: "",
    });

    // Fetch configuration items for the current user.
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
                    if (Array.isArray(data)) {
                        setItems(data);
                    } else {
                        console.error("Unexpected API response:", data);
                        setItems([]);
                    }
                })
                .catch((err) => console.error("Fetch error:", err));
        }
    }, [session]);

    // Fetch available types (used in both the new item form and inline editing).
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
                    if (Array.isArray(data)) {
                        setAvailableTypes(data);
                    } else {
                        console.error("Unexpected types response:", data);
                        setAvailableTypes([]);
                    }
                })
                .catch((err) => console.error("Fetch types error:", err));
        }
    }, [session]);

    // Create a new configuration item.
    const createItem = async () => {
        const res = await fetch("/api/configuration-items", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(newItem),
        });
        const created = await res.json();
        setItems((prev) => [...prev, created]);
        // Clear the form.
        setNewItem({ name: "", description: "", itemTypeId: "", ip: "", mac: "" });
    };

    // Delete a configuration item.
    const deleteItem = async (id: string) => {
        await fetch(`/api/configuration-items/${id}`, { method: "DELETE" });
        setItems((prev) => prev.filter((item) => item.id !== id));
    };

    // Start inline editing for a specific configuration item.
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

    // Cancel editing.
    const cancelEditing = () => {
        setEditingItemId(null);
        setEditingItemData({ name: "", description: "", ip: "", mac: "", itemTypeId: "" });
    };

    // Update a configuration item.
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

    if (status === "loading") return <p>Loading...</p>;

    return (
        <div className="min-h-screen bg-gray-100">
            <main className="max-w-7xl mx-auto p-6">
                {/* Section for adding a new configuration item */}
                <section className="mb-6">
                    <h2 className="text-2xl font-bold mb-4">Add New Configuration Item</h2>
                    <div className="bg-white p-4 rounded shadow-md mb-6">
                        <div className="flex flex-col gap-4">
                            <input
                                type="text"
                                placeholder="Name"
                                value={newItem.name}
                                onChange={(e) =>
                                    setNewItem({ ...newItem, name: e.target.value })
                                }
                                className="border rounded p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                            <input
                                type="text"
                                placeholder="Description"
                                value={newItem.description}
                                onChange={(e) =>
                                    setNewItem({ ...newItem, description: e.target.value })
                                }
                                className="border rounded p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                            <input
                                type="text"
                                placeholder="IP Address"
                                value={newItem.ip}
                                onChange={(e) =>
                                    setNewItem({ ...newItem, ip: e.target.value })
                                }
                                className="border rounded p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                            <input
                                type="text"
                                placeholder="MAC Address"
                                value={newItem.mac}
                                onChange={(e) =>
                                    setNewItem({ ...newItem, mac: e.target.value })
                                }
                                className="border rounded p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                            <select
                                value={newItem.itemTypeId}
                                onChange={(e) =>
                                    setNewItem({ ...newItem, itemTypeId: e.target.value })
                                }
                                className="border rounded p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="">Select a type (optional)</option>
                                {availableTypes.map((type) => (
                                    <option key={type.id} value={type.id}>
                                        {type.name}
                                    </option>
                                ))}
                            </select>
                            <Button onClick={createItem}>Add Item</Button>
                        </div>
                    </div>
                </section>

                {/* Section for listing configuration items with inline editing */}
                <section>
                    <h2 className="text-2xl font-bold mb-4">Configuration Items</h2>
                    <div className="bg-white shadow rounded overflow-x-auto">
                        <table className="min-w-full">
                            <thead className="bg-gray-200">
                                <tr>
                                    <th className="py-2 px-4 border">Name</th>
                                    <th className="py-2 px-4 border">Description</th>
                                    <th className="py-2 px-4 border">IP</th>
                                    <th className="py-2 px-4 border">MAC</th>
                                    <th className="py-2 px-4 border">Type</th>
                                    <th className="py-2 px-4 border">Actions</th>
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
                                                        setEditingItemData({
                                                            ...editingItemData,
                                                            name: e.target.value,
                                                        })
                                                    }
                                                    className="border rounded p-1"
                                                />
                                            </td>
                                            <td className="py-2 px-4 border">
                                                <input
                                                    type="text"
                                                    value={editingItemData.description}
                                                    onChange={(e) =>
                                                        setEditingItemData({
                                                            ...editingItemData,
                                                            description: e.target.value,
                                                        })
                                                    }
                                                    className="border rounded p-1"
                                                />
                                            </td>
                                            <td className="py-2 px-4 border">
                                                <input
                                                    type="text"
                                                    value={editingItemData.ip}
                                                    onChange={(e) =>
                                                        setEditingItemData({
                                                            ...editingItemData,
                                                            ip: e.target.value,
                                                        })
                                                    }
                                                    className="border rounded p-1"
                                                />
                                            </td>
                                            <td className="py-2 px-4 border">
                                                <input
                                                    type="text"
                                                    value={editingItemData.mac}
                                                    onChange={(e) =>
                                                        setEditingItemData({
                                                            ...editingItemData,
                                                            mac: e.target.value,
                                                        })
                                                    }
                                                    className="border rounded p-1"
                                                />
                                            </td>
                                            <td className="py-2 px-4 border">
                                                <select
                                                    value={editingItemData.itemTypeId}
                                                    onChange={(e) =>
                                                        setEditingItemData({
                                                            ...editingItemData,
                                                            itemTypeId: e.target.value,
                                                        })
                                                    }
                                                    className="border rounded p-1"
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
                                                <Button onClick={() => updateItem(item.id)}>
                                                    Save
                                                </Button>
                                                <Button onClick={cancelEditing} >
                                                    Cancel
                                                </Button>
                                            </td>
                                        </tr>
                                    ) : (
                                        <tr key={item.id}>
                                            <td className="py-2 px-4 border">{item.name}</td>
                                            <td className="py-2 px-4 border">{item.description}</td>
                                            <td className="py-2 px-4 border">{item.ip}</td>
                                            <td className="py-2 px-4 border">{item.mac}</td>
                                            <td className="py-2 px-4 border">
                                                {item.itemType ? item.itemType.name : "None"}
                                            </td>
                                            <td className="py-2 px-4 border flex gap-2">
                                                <Button onClick={() => startEditing(item)}>Edit</Button>
                                                <Button
                                                    onClick={() => deleteItem(item.id)}

                                                >
                                                    Delete
                                                </Button>
                                            </td>
                                        </tr>
                                    )
                                )}
                            </tbody>
                        </table>
                    </div>
                </section>
            </main>
        </div>
    );
}
