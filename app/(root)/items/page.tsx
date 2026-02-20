'use client';

import { useSession } from "next-auth/react";
import { useState, useEffect } from "react";
import { Button } from "@components/ui/Button";
import Image from "next/image";

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
}

interface Type {
    id: string;
    name: string;
}

const statusColors: Record<AssetStatus, string> = {
    ACTIVE: "bg-green-100 text-green-800",
    DEPRECATED: "bg-red-100 text-red-800",
    MAINTENANCE: "bg-yellow-100 text-yellow-800",
};

const statusLabels: Record<AssetStatus, string> = {
    ACTIVE: "Active",
    DEPRECATED: "Deprecated",
    MAINTENANCE: "Maintenance",
};

export default function ItemsPage() {
    const { data: session, status } = useSession();
    const [items, setItems] = useState<ConfigItem[]>([]);
    const [filteredItems, setFilteredItems] = useState<ConfigItem[]>([]);
    const [availableTypes, setAvailableTypes] = useState<Type[]>([]);
    const [newItem, setNewItem] = useState({
        name: "",
        description: "",
        itemTypeId: "",
        ip: "",
        mac: "",
        status: "ACTIVE" as AssetStatus,
    });
    const [editingItemId, setEditingItemId] = useState<string | null>(null);
    const [editingItemData, setEditingItemData] = useState({
        name: "",
        description: "",
        ip: "",
        mac: "",
        itemTypeId: "",
        status: "ACTIVE" as AssetStatus,
    });
    const [csvContent, setCsvContent] = useState("");
    const [statusFilter, setStatusFilter] = useState<AssetStatus | "ALL">("ALL");

    // Fetch items and types as before
    useEffect(() => {
        if (session) {
            fetchItems();
            fetchTypes();
        }
    }, [session]);

    // Filter items when statusFilter changes
    useEffect(() => {
        if (statusFilter === "ALL") {
            setFilteredItems(items);
        } else {
            setFilteredItems(items.filter((item) => item.status === statusFilter));
        }
    }, [statusFilter, items]);

    const fetchItems = async () => {
        try {
            const res = await fetch("/api/configuration-items");
            if (!res.ok) {
                console.error("API Error:", await res.text());
                return;
            }
            const data = await res.json();
            if (Array.isArray(data)) {
                setItems(data);
                setFilteredItems(data);
            } else {
                console.error("Unexpected API response:", data);
            }
        } catch (err) {
            console.error("Fetch error:", err);
        }
    };

    const fetchTypes = async () => {
        try {
            const res = await fetch("/api/types");
            if (!res.ok) {
                console.error("Types API Error:", await res.text());
                return;
            }
            const data = await res.json();
            if (Array.isArray(data)) {
                setAvailableTypes(data);
            } else {
                console.error("Unexpected types response:", data);
            }
        } catch (err) {
            console.error("Fetch types error:", err);
        }
    };

    const createItem = async () => {
        const res = await fetch("/api/configuration-items", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(newItem),
        });
        const created = await res.json();
        setItems((prev) => [...prev, created]);
        setNewItem({ name: "", description: "", itemTypeId: "", ip: "", mac: "", status: "ACTIVE" });
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
            status: item.status || "ACTIVE",
        });
    };

    const cancelEditing = () => {
        setEditingItemId(null);
        setEditingItemData({ name: "", description: "", ip: "", mac: "", itemTypeId: "", status: "ACTIVE" });
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

    // CSV Upload Handlers
    const handleCsvFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                const text = event.target?.result as string;
                setCsvContent(text);
            };
            reader.readAsText(file);
        }
    };

    const uploadCsv = async () => {
        if (!csvContent) return;
        try {
            const res = await fetch("/api/configuration-items/upload", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ csv: csvContent }),
            });
            if (res.ok) {
                fetchItems();
            } else {
                console.error("CSV upload failed:", await res.text());
            }
        } catch (error) {
            console.error("Error uploading CSV:", error);
        }
    };

    if (status === "loading") return <p className="p-6 text-lg">Loading...</p>;

    return (
        <div className="min-h-screen bg-gray-50">
            <main className="max-w-7xl mx-auto p-8 space-y-10">
                {/* CSV Upload Section */}
                <section className="bg-white p-6 rounded-lg shadow-sm">
                    <div className="flex items-center">
                        <Image src="file.svg" width={24} height={24} alt="file" ></Image>
                        <h2 className="text-2xl font-semibold text-gray-700 mb-4">Upload CSV File</h2>
                    </div>
                    <div className="flex flex-col md:flex-row md:items-center md:space-x-4">
                        <input
                            type="file"
                            accept=".csv"
                            onChange={handleCsvFileChange}
                            className="mb-4 md:mb-0"
                        />
                        <Button onClick={uploadCsv}>Upload CSV</Button>
                        {/* Info icon with tooltip */}
                        <div className="relative inline-block group ml-4">
                            <svg
                                className="w-6 h-6 text-gray-500 cursor-help"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                                xmlns="http://www.w3.org/2000/svg"
                            >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M12 2a10 10 0 110 20 10 10 0 010-20z" />
                            </svg>
                            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-64 p-2 bg-gray-700 text-white text-xs rounded-sm opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                                <p className="mb-1 font-semibold">Example CSV Format:</p>
                                <code>Name,Description,IP,MAC,ItemTypeId,Status</code>
                                <br />
                                <code>Server 1,Main server,192.168.1.10,00:11:22:33:44:55,abc123,ACTIVE</code>
                                <p className="mt-1">Status: ACTIVE, MAINTENANCE, DEPRECATED</p>
                            </div>
                        </div>
                    </div>
                </section>

                {/* New Item Form */}
                <section className="bg-white p-6 rounded-lg shadow-sm">
                    <h2 className="text-2xl font-semibold text-gray-700 mb-4">Add New Configuration Item</h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <input
                            type="text"
                            placeholder="Name"
                            value={newItem.name}
                            onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                            className="border rounded-sm p-2"
                        />
                        <input
                            type="text"
                            placeholder="Description"
                            value={newItem.description}
                            onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
                            className="border rounded-sm p-2"
                        />
                        <input
                            type="text"
                            placeholder="IP Address"
                            value={newItem.ip}
                            onChange={(e) => setNewItem({ ...newItem, ip: e.target.value })}
                            className="border rounded-sm p-2"
                        />
                        <input
                            type="text"
                            placeholder="MAC Address"
                            value={newItem.mac}
                            onChange={(e) => setNewItem({ ...newItem, mac: e.target.value })}
                            className="border rounded-sm p-2"
                        />
                        <select
                            value={newItem.itemTypeId}
                            onChange={(e) => setNewItem({ ...newItem, itemTypeId: e.target.value })}
                            className="border rounded-sm p-2"
                        >
                            <option value="">Select a type (optional)</option>
                            {availableTypes.map((type) => (
                                <option key={type.id} value={type.id}>
                                    {type.name}
                                </option>
                            ))}
                        </select>
                        <select
                            value={newItem.status}
                            onChange={(e) => setNewItem({ ...newItem, status: e.target.value as AssetStatus })}
                            className="border rounded-sm p-2"
                        >
                            <option value="ACTIVE">Active</option>
                            <option value="MAINTENANCE">Maintenance</option>
                            <option value="DEPRECATED">Deprecated</option>
                        </select>
                    </div>
                    <div className="mt-4">
                        <Button onClick={createItem}>Add Item</Button>
                    </div>
                </section>

                {/* Filter Section */}
                <section className="bg-white p-4 rounded-lg shadow-sm">
                    <div className="flex items-center gap-4">
                        <label className="font-semibold text-gray-700">Filter by Status:</label>
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value as AssetStatus | "ALL")}
                            className="border rounded-sm p-2"
                        >
                            <option value="ALL">All Statuses</option>
                            <option value="ACTIVE">Active</option>
                            <option value="MAINTENANCE">Maintenance</option>
                            <option value="DEPRECATED">Deprecated</option>
                        </select>
                        <span className="text-gray-500 text-sm">
                            Showing {filteredItems.length} of {items.length} items
                        </span>
                    </div>
                </section>

                {/* Items Table */}
                <section className="bg-white shadow-sm rounded-sm overflow-x-auto">
                    <table className="min-w-full">
                        <thead className="bg-gray-200">
                            <tr>
                                <th className="py-3 px-4 border">Name</th>
                                <th className="py-3 px-4 border">Description</th>
                                <th className="py-3 px-4 border">IP</th>
                                <th className="py-3 px-4 border">MAC</th>
                                <th className="py-3 px-4 border">Type</th>
                                <th className="py-3 px-4 border">Status</th>
                                <th className="py-3 px-4 border">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredItems.map((item) =>
                                editingItemId === item.id ? (
                                    <tr key={item.id}>
                                        <td className="py-2 px-4 border">
                                            <input
                                                type="text"
                                                value={editingItemData.name}
                                                onChange={(e) =>
                                                    setEditingItemData({ ...editingItemData, name: e.target.value })
                                                }
                                                className="w-full border rounded-sm p-1"
                                            />
                                        </td>
                                        <td className="py-2 px-4 border">
                                            <input
                                                type="text"
                                                value={editingItemData.description}
                                                onChange={(e) =>
                                                    setEditingItemData({ ...editingItemData, description: e.target.value })
                                                }
                                                className="w-full border rounded-sm p-1"
                                            />
                                        </td>
                                        <td className="py-2 px-4 border">
                                            <input
                                                type="text"
                                                value={editingItemData.ip}
                                                onChange={(e) =>
                                                    setEditingItemData({ ...editingItemData, ip: e.target.value })
                                                }
                                                className="w-full border rounded-sm p-1"
                                            />
                                        </td>
                                        <td className="py-2 px-4 border">
                                            <input
                                                type="text"
                                                value={editingItemData.mac}
                                                onChange={(e) =>
                                                    setEditingItemData({ ...editingItemData, mac: e.target.value })
                                                }
                                                className="w-full border rounded-sm p-1"
                                            />
                                        </td>
                                        <td className="py-2 px-4 border">
                                            <select
                                                value={editingItemData.itemTypeId}
                                                onChange={(e) =>
                                                    setEditingItemData({ ...editingItemData, itemTypeId: e.target.value })
                                                }
                                                className="w-full border rounded-sm p-1"
                                            >
                                                <option value="">None</option>
                                                {availableTypes.map((type) => (
                                                    <option key={type.id} value={type.id}>
                                                        {type.name}
                                                    </option>
                                                ))}
                                            </select>
                                        </td>
                                        <td className="py-2 px-4 border">
                                            <select
                                                value={editingItemData.status}
                                                onChange={(e) =>
                                                    setEditingItemData({ ...editingItemData, status: e.target.value as AssetStatus })
                                                }
                                                className="w-full border rounded-sm p-1"
                                            >
                                                <option value="ACTIVE">Active</option>
                                                <option value="MAINTENANCE">Maintenance</option>
                                                <option value="DEPRECATED">Deprecated</option>
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
                                        <td className="py-2 px-4 border">
                                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[item.status]}`}>
                                                {statusLabels[item.status]}
                                            </span>
                                        </td>
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
