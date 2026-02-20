'use client';

import { useSession } from "next-auth/react";
import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/Button";
import Image from "next/image";

interface Tag {
    id: string;
    name: string;
    color?: string | null;
    description?: string | null;
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
}

interface Type {
    id: string;
    name: string;
}

interface PaginationData {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
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
    const [availableTypes, setAvailableTypes] = useState<Type[]>([]);
    const [availableTags, setAvailableTags] = useState<Tag[]>([]);
    const [pagination, setPagination] = useState<PaginationData>({
        total: 0,
        page: 1,
        limit: 10,
        totalPages: 1,
    });

    // Search and filter states
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedTypeId, setSelectedTypeId] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState<AssetStatus | "ALL">("ALL");

    const [newItem, setNewItem] = useState({
        name: "",
        description: "",
        itemTypeId: "",
        ip: "",
        mac: "",
status: "ACTIVE" as AssetStatus,
        tagIds: [] as string[],
    });
    const [editingItemId, setEditingItemId] = useState<string | null>(null);
    const [editingItemData, setEditingItemData] = useState({
        name: "",
        description: "",
        ip: "",
        mac: "",
        itemTypeId: "",
status: "ACTIVE" as AssetStatus,
        tagIds: [] as string[],
    });
    const [csvContent, setCsvContent] = useState("");
    // Tag management modal state
    const [showTagModal, setShowTagModal] = useState(false);
    const [newTagName, setNewTagName] = useState("");
    const [newTagColor, setNewTagColor] = useState("#3b82f6");
    const [newTagDescription, setNewTagDescription] = useState("");

    // Debounce search input
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(searchQuery);
            setPagination(prev => ({ ...prev, page: 1 })); // Reset to first page on search
        }, 300);
        return () => clearTimeout(timer);
    }, [searchQuery]);

    // Fetch items when session, page, filters change
    useEffect(() => {
        if (session) {
            fetchItems();
        }
    }, [session, pagination.page, debouncedSearch, selectedTypeId, statusFilter]);

    // Fetch types and tags on mount
    useEffect(() => {
        if (session) {
            fetchTypes();
            fetchTags();
        }
    }, [session]);

    const fetchItems = async () => {
        try {
            const params = new URLSearchParams({
                page: pagination.page.toString(),
                limit: pagination.limit.toString(),
            });
            if (debouncedSearch) params.append("search", debouncedSearch);
            if (selectedTypeId) params.append("typeId", selectedTypeId);
            if (statusFilter !== "ALL") params.append("status", statusFilter);

            const res = await fetch(`/api/configuration-items?${params.toString()}`);
            if (!res.ok) {
                console.error("API Error:", await res.text());
                return;
            }
            const data = await res.json();
            setItems(data.items || []);
            setPagination(data.pagination || { total: 0, page: 1, limit: 10, totalPages: 1 });
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

    const fetchTags = async () => {
        try {
            const res = await fetch("/api/tags");
            if (!res.ok) {
                console.error("Tags API Error:", await res.text());
                return;
            }
            const data = await res.json();
            if (Array.isArray(data)) {
                setAvailableTags(data);
            } else {
                console.error("Unexpected tags response:", data);
            }
        } catch (err) {
            console.error("Fetch tags error:", err);
        }
    };

    const createItem = async () => {
        const res = await fetch("/api/configuration-items", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(newItem),
        });
        const created = await res.json();
        setItems((prev) => [created, ...prev]);
setNewItem({ name: "", description: "", itemTypeId: "", ip: "", mac: "", status: "ACTIVE", tagIds: [] });
        // Refresh to get updated pagination
        fetchItems();
    };

    const deleteItem = async (id: string) => {
        await fetch(`/api/configuration-items/${id}`, { method: "DELETE" });
        setItems((prev) => prev.filter((item) => item.id !== id));
        fetchItems();
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
            tagIds: item.tags?.map(t => t.id) || [],
        });
    };

    const cancelEditing = () => {
        setEditingItemId(null);
setEditingItemData({ name: "", description: "", ip: "", mac: "", itemTypeId: "", status: "ACTIVE", tagIds: [] });
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

    // Tag management
    const createTag = async () => {
        if (!newTagName.trim()) return;
        try {
            const res = await fetch("/api/tags", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: newTagName.trim(),
                    color: newTagColor,
                    description: newTagDescription || null,
                }),
            });
            if (res.ok) {
                const newTag = await res.json();
                setAvailableTags((prev) => [...prev, newTag]);
                setNewTagName("");
                setNewTagColor("#3b82f6");
                setNewTagDescription("");
                setShowTagModal(false);
            } else {
                console.error("Failed to create tag:", await res.text());
            }
        } catch (error) {
            console.error("Error creating tag:", error);
        }
    };

    const deleteTag = async (tagId: string) => {
        if (!confirm("Are you sure you want to delete this tag?")) return;
        try {
            const res = await fetch(`/api/tags/${tagId}`, { method: "DELETE" });
            if (res.ok) {
                setAvailableTags((prev) => prev.filter((t) => t.id !== tagId));
            } else {
                console.error("Failed to delete tag:", await res.text());
            }
        } catch (error) {
            console.error("Error deleting tag:", error);
        }
    };

    // Helper to toggle tag selection
    const toggleTagSelection = (tagId: string, isEditing: boolean) => {
        if (isEditing) {
            setEditingItemData(prev => ({
                ...prev,
                tagIds: prev.tagIds.includes(tagId)
                    ? prev.tagIds.filter(id => id !== tagId)
                    : [...prev.tagIds, tagId]
            }));
        } else {
            setNewItem(prev => ({
                ...prev,
                tagIds: prev.tagIds.includes(tagId)
                    ? prev.tagIds.filter(id => id !== tagId)
                    : [...prev.tagIds, tagId]
            }));
        }
    };

    // Helper to get tag by ID
    const getTagById = (id: string) => availableTags.find(t => t.id === id);

    const clearFilters = () => {
        setSearchQuery("");
        setSelectedTypeId("");
        setStatusFilter("ALL");
        setPagination(prev => ({ ...prev, page: 1 }));
    };

    const goToPage = (page: number) => {
        if (page >= 1 && page <= pagination.totalPages) {
            setPagination(prev => ({ ...prev, page }));
        }
    };

    // Generate pagination range
    const getPaginationRange = () => {
        const { page, totalPages } = pagination;
        const range: (number | string)[] = [];
        const maxVisible = 5;

        if (totalPages <= maxVisible) {
            for (let i = 1; i <= totalPages; i++) range.push(i);
        } else {
            if (page <= 3) {
                for (let i = 1; i <= 4; i++) range.push(i);
                range.push("...");
                range.push(totalPages);
            } else if (page >= totalPages - 2) {
                range.push(1);
                range.push("...");
                for (let i = totalPages - 3; i <= totalPages; i++) range.push(i);
            } else {
                range.push(1);
                range.push("...");
                for (let i = page - 1; i <= page + 1; i++) range.push(i);
                range.push("...");
                range.push(totalPages);
            }
        }
        return range;
    };

    if (status === "loading") return <p className="p-6 text-lg">Loading...</p>;

    return (
        <div className="min-h-screen bg-gray-50">
            <main className="max-w-7xl mx-auto p-8 space-y-10">
                {/* Tag Management Section */}
                <section className="bg-white p-6 rounded-lg shadow-sm">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-2xl font-semibold text-gray-700">Tags</h2>
                        <Button onClick={() => setShowTagModal(true)}>+ Create Tag</Button>
                    </div>
                    {availableTags.length === 0 ? (
                        <p className="text-gray-500">No tags created yet.</p>
                    ) : (
                        <div className="flex flex-wrap gap-2">
                            {availableTags.map((tag) => (
                                <div
                                    key={tag.id}
                                    className="flex items-center gap-2 px-3 py-1 rounded-full text-sm"
                                    style={{
                                        backgroundColor: tag.color ? `${tag.color}20` : '#e5e7eb',
                                        border: `1px solid ${tag.color || '#d1d5db'}`
                                    }}
                                >
                                    <span style={{ color: tag.color || '#374151' }}>{tag.name}</span>
                                    <button
                                        onClick={() => deleteTag(tag.id)}
                                        className="text-gray-400 hover:text-red-500 font-bold"
                                    >
                                        ×
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </section>

                {/* Tag Modal */}
                {showTagModal && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                        <div className="bg-white p-6 rounded-lg shadow-lg max-w-md w-full">
                            <h3 className="text-xl font-semibold mb-4">Create New Tag</h3>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-600 mb-1">Name *</label>
                                    <input
                                        type="text"
                                        value={newTagName}
                                        onChange={(e) => setNewTagName(e.target.value)}
                                        className="w-full border rounded-sm p-2"
                                        placeholder="e.g., production"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-600 mb-1">Color</label>
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="color"
                                            value={newTagColor}
                                            onChange={(e) => setNewTagColor(e.target.value)}
                                            className="h-10 w-20"
                                        />
                                        <span className="text-sm text-gray-500">{newTagColor}</span>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-600 mb-1">Description</label>
                                    <input
                                        type="text"
                                        value={newTagDescription}
                                        onChange={(e) => setNewTagDescription(e.target.value)}
                                        className="w-full border rounded-sm p-2"
                                        placeholder="Optional description"
                                    />
                                </div>
                            </div>
                            <div className="flex gap-2 mt-6">
                                <Button onClick={createTag}>Create</Button>
                                <Button onClick={() => setShowTagModal(false)} variant="outline">Cancel</Button>
                            </div>
                        </div>
                    </div>
                )}

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
                    {/* Tags selection */}
                    <div className="mt-4">
                        <label className="block text-sm font-medium text-gray-600 mb-2">Tags</label>
                        <div className="flex flex-wrap gap-2">
                            {availableTags.map((tag) => (
                                <button
                                    key={tag.id}
                                    onClick={() => toggleTagSelection(tag.id, false)}
                                    className={`px-3 py-1 rounded-full text-sm transition-all ${
                                        newItem.tagIds.includes(tag.id)
                                            ? 'ring-2 ring-offset-1'
                                            : 'opacity-60 hover:opacity-100'
                                    }`}
                                    style={{
                                        backgroundColor: tag.color ? `${tag.color}30` : '#e5e7eb',
                                        border: `1px solid ${tag.color || '#d1d5db'}`,
                                        color: tag.color || '#374151'
                                    }}
                                >
                                    {newItem.tagIds.includes(tag.id) && '✓ '}{tag.name}
                                </button>
                            ))}
                            {availableTags.length === 0 && (
                                <span className="text-sm text-gray-500">No tags available. Create some above!</span>
                            )}
                        </div>
                    </div>
                    <div className="mt-4">
                        <Button onClick={createItem}>Add Item</Button>
                    </div>
                </section>

                {/* Search and Filter Section */}
                <section className="bg-white p-6 rounded-lg shadow-sm">
                    <h2 className="text-2xl font-semibold text-gray-700 mb-4">Search & Filter</h2>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-600 mb-1">Search</label>
                            <input
                                type="text"
                                placeholder="Search name, IP, MAC, description..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full border rounded-sm p-2"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-600 mb-1">Filter by Type</label>
                            <select
                                value={selectedTypeId}
                                onChange={(e) => {
                                    setSelectedTypeId(e.target.value);
                                    setPagination(prev => ({ ...prev, page: 1 }));
                                }}
                                className="w-full border rounded-sm p-2"
                            >
                                <option value="">All Types</option>
                                {availableTypes.map((type) => (
                                    <option key={type.id} value={type.id}>
                                        {type.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-600 mb-1">Filter by Status</label>
                            <select
                                value={statusFilter}
                                onChange={(e) => {
                                    setStatusFilter(e.target.value as AssetStatus | "ALL");
                                    setPagination(prev => ({ ...prev, page: 1 }));
                                }}
                                className="w-full border rounded-sm p-2"
                            >
                                <option value="ALL">All Statuses</option>
                                <option value="ACTIVE">Active</option>
                                <option value="MAINTENANCE">Maintenance</option>
                                <option value="DEPRECATED">Deprecated</option>
                            </select>
                        </div>
                        <div className="flex items-end">
                            <Button onClick={clearFilters} variant="outline">Clear Filters</Button>
                        </div>
                    </div>
                    <p className="mt-2 text-sm text-gray-500">
                        Showing {items.length} of {pagination.total} items
                    </p>
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
                                <th className="py-3 px-4 border">Tags</th>
                                <th className="py-3 px-4 border">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {items.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="py-8 px-4 text-center text-gray-500">
                                        No items found. Try adjusting your search or filters.
                                    </td>
                                </tr>
                            ) : (
                                items.map((item) =>
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
                                            <td className="py-2 px-4 border">
                                                <div className="flex flex-wrap gap-1">
                                                    {availableTags.map((tag) => (
                                                        <button
                                                            key={tag.id}
                                                            onClick={() => toggleTagSelection(tag.id, true)}
                                                            className={`px-2 py-0.5 rounded-full text-xs transition-all ${
                                                                editingItemData.tagIds.includes(tag.id)
                                                                    ? 'ring-1 ring-offset-1'
                                                                    : 'opacity-50'
                                                            }`}
                                                            style={{
                                                                backgroundColor: tag.color ? `${tag.color}30` : '#e5e7eb',
                                                                border: `1px solid ${tag.color || '#d1d5db'}`,
                                                                color: tag.color || '#374151',
                                                            }}
                                                        >
                                                            {editingItemData.tagIds.includes(tag.id) ? '✓ ' : ''}{tag.name}
                                                        </button>
                                                    ))}
                                                </div>
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
                                            <td className="py-2 px-4 border">
                                                <div className="flex flex-wrap gap-1">
                                                    {item.tags?.map((tag) => (
                                                        <span
                                                            key={tag.id}
                                                            className="px-2 py-0.5 rounded-full text-xs"
                                                            style={{
                                                                backgroundColor: tag.color ? `${tag.color}30` : '#e5e7eb',
                                                                border: `1px solid ${tag.color || '#d1d5db'}`,
                                                                color: tag.color || '#374151',
                                                            }}
                                                        >
                                                            {tag.name}
                                                        </span>
                                                    ))}
                                                    {(!item.tags || item.tags.length === 0) && (
                                                        <span className="text-gray-400 text-xs">-</span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="py-2 px-4 border flex gap-2">
                                                <Button onClick={() => startEditing(item)}>Edit</Button>
                                                <Button onClick={() => deleteItem(item.id)} variant="destructive">Delete</Button>
                                            </td>
                                        </tr>
                                    )
                                )
                            )}
                        </tbody>
                    </table>

                    {/* Pagination Controls */}
                    {pagination.totalPages > 1 && (
                        <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-t">
                            <div className="flex items-center">
                                <span className="text-sm text-gray-600">
                                    Page {pagination.page} of {pagination.totalPages}
                                </span>
                            </div>
                            <div className="flex items-center space-x-1">
                                <Button
                                    onClick={() => goToPage(pagination.page - 1)}
                                    disabled={pagination.page === 1}
                                    variant="outline"
                                >
                                    Previous
                                </Button>
                                {getPaginationRange().map((page, idx) =>
                                    page === "..." ? (
                                        <span key={idx} className="px-3 py-1 text-gray-500">...</span>
                                    ) : (
                                        <Button
                                            key={idx}
                                            onClick={() => goToPage(page as number)}
                                            variant={pagination.page === page ? "default" : "outline"}
                                        >
                                            {page}
                                        </Button>
                                    )
                                )}
                                <Button
                                    onClick={() => goToPage(pagination.page + 1)}
                                    disabled={pagination.page === pagination.totalPages}
                                    variant="outline"
                                >
                                    Next
                                </Button>
                            </div>
                        </div>
                    )}
                </section>
            </main>
        </div>
    );
}
