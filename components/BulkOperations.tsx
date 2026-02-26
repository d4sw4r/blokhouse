// components/BulkOperations.tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";

interface Tag {
    id: string;
    name: string;
    color?: string | null;
}

type AssetStatus = "ACTIVE" | "DEPRECATED" | "MAINTENANCE";

interface BulkOperationsProps {
    selectedIds: string[];
    availableTags: Tag[];
    availableStatuses: { value: AssetStatus; label: string; color: string }[];
    onClearSelection: () => void;
    onRefresh: () => void;
}

export default function BulkOperations({
    selectedIds,
    availableTags,
    availableStatuses,
    onClearSelection,
    onRefresh,
}: BulkOperationsProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [operation, setOperation] = useState<"status" | "addTags" | "removeTags" | "delete" | null>(null);
    const [selectedStatus, setSelectedStatus] = useState<AssetStatus>("ACTIVE");
    const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);

    if (selectedIds.length === 0) return null;

    const handleStatusChange = async () => {
        if (!confirm(`Change status to "${selectedStatus}" for ${selectedIds.length} items?`)) return;
        
        setLoading(true);
        try {
            const res = await fetch("/api/configuration-items/bulk", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    ids: selectedIds,
                    operation: "updateStatus",
                    status: selectedStatus,
                }),
            });
            
            if (res.ok) {
                onClearSelection();
                onRefresh();
                setIsOpen(false);
                setOperation(null);
            } else {
                alert("Bulk status update failed");
            }
        } catch (error) {
            alert("Network error");
        } finally {
            setLoading(false);
        }
    };

    const handleAddTags = async () => {
        if (selectedTagIds.length === 0) return;
        if (!confirm(`Add ${selectedTagIds.length} tag(s) to ${selectedIds.length} items?`)) return;
        
        setLoading(true);
        try {
            // Add tags one by one for each item
            for (const itemId of selectedIds) {
                for (const tagId of selectedTagIds) {
                    await fetch(`/api/configuration-items/${itemId}/tags`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ tagId }),
                    });
                }
            }
            onClearSelection();
            onRefresh();
            setIsOpen(false);
            setOperation(null);
            setSelectedTagIds([]);
        } catch (error) {
            alert("Network error");
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async () => {
        if (!confirm(`⚠️ Delete ${selectedIds.length} items permanently? This cannot be undone!`)) return;
        
        setLoading(true);
        try {
            for (const itemId of selectedIds) {
                await fetch(`/api/configuration-items/${itemId}`, {
                    method: "DELETE",
                });
            }
            onClearSelection();
            onRefresh();
            setIsOpen(false);
            setOperation(null);
        } catch (error) {
            alert("Network error");
        } finally {
            setLoading(false);
        }
    };

    const toggleTagSelection = (tagId: string) => {
        setSelectedTagIds(prev =>
            prev.includes(tagId)
                ? prev.filter(id => id !== tagId)
                : [...prev, tagId]
        );
    };

    return (
        <div className="bg-brand-primary/10 border border-brand-primary/30 rounded-lg p-4 mb-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <span className="bg-brand-primary text-white px-3 py-1 rounded-full text-sm font-medium">
                        {selectedIds.length} selected
                    </span>
                    <span className="text-gray-600 text-sm">Bulk operations available</span>
                </div>
                <div className="flex items-center gap-2">
                    {!isOpen && (
                        <>
                            <Button onClick={() => { setIsOpen(true); setOperation("status"); }} size="sm" variant="outline">
                                Change Status
                            </Button>
                            <Button onClick={() => { setIsOpen(true); setOperation("addTags"); }} size="sm" variant="outline">
                                Add Tags
                            </Button>
                            <Button onClick={() => { setIsOpen(true); setOperation("delete"); }} size="sm" variant="destructive">
                                Delete
                            </Button>
                        </>
                    )}
                    <Button onClick={onClearSelection} size="sm" variant="outline">
                        Clear
                    </Button>
                </div>
            </div>

            {isOpen && (
                <div className="mt-4 pt-4 border-t border-brand-primary/20">
                    {operation === "status" && (
                        <div className="space-y-3">
                            <label className="block text-sm font-medium text-gray-700">
                                Change status to:
                            </label>
                            <div className="flex flex-wrap gap-2">
                                {availableStatuses.map((status) => (
                                    <button
                                        key={status.value}
                                        onClick={() => setSelectedStatus(status.value)}
                                        className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                                            selectedStatus === status.value
                                                ? "ring-2 ring-offset-1 " + status.color
                                                : "opacity-60 hover:opacity-100 " + status.color
                                        }`}
                                    >
                                        {selectedStatus === status.value && "✓ "}{status.label}
                                    </button>
                                ))}
                            </div>
                            <div className="flex gap-2 pt-2">
                                <Button onClick={handleStatusChange} disabled={loading} size="sm">
                                    {loading ? "Updating..." : "Apply"}
                                </Button>
                                <Button onClick={() => { setIsOpen(false); setOperation(null); }} size="sm" variant="outline">
                                    Cancel
                                </Button>
                            </div>
                        </div>
                    )}

                    {operation === "addTags" && (
                        <div className="space-y-3">
                            <label className="block text-sm font-medium text-gray-700">
                                Select tags to add:
                            </label>
                            <div className="flex flex-wrap gap-2">
                                {availableTags.map((tag) => (
                                    <button
                                        key={tag.id}
                                        onClick={() => toggleTagSelection(tag.id)}
                                        className={`px-3 py-1.5 rounded-full text-sm transition-all ${
                                            selectedTagIds.includes(tag.id)
                                                ? 'ring-2 ring-offset-1'
                                                : 'opacity-60 hover:opacity-100'
                                        }`}
                                        style={{
                                            backgroundColor: tag.color ? `${tag.color}30` : '#e5e7eb',
                                            border: `1px solid ${tag.color || '#d1d5db'}`,
                                            color: tag.color || '#374151',
                                        }}
                                    >
                                        {selectedTagIds.includes(tag.id) && '✓ '}{tag.name}
                                    </button>
                                ))}
                                {availableTags.length === 0 && (
                                    <span className="text-sm text-gray-500">No tags available</span>
                                )}
                            </div>
                            <div className="flex gap-2 pt-2">
                                <Button 
                                    onClick={handleAddTags} 
                                    disabled={loading || selectedTagIds.length === 0} 
                                    size="sm"
                                >
                                    {loading ? "Adding..." : `Add ${selectedTagIds.length} Tag(s)`}
                                </Button>
                                <Button onClick={() => { setIsOpen(false); setOperation(null); }} size="sm" variant="outline">
                                    Cancel
                                </Button>
                            </div>
                        </div>
                    )}

                    {operation === "delete" && (
                        <div className="space-y-3">
                            <div className="bg-red-50 border border-red-200 rounded p-3">
                                <p className="text-red-800 text-sm font-medium">
                                    ⚠️ Warning: This will permanently delete {selectedIds.length} items!
                                </p>
                            </div>
                            <div className="flex gap-2">
                                <Button onClick={handleDelete} disabled={loading} size="sm" variant="destructive">
                                    {loading ? "Deleting..." : "Confirm Delete"}
                                </Button>
                                <Button onClick={() => { setIsOpen(false); setOperation(null); }} size="sm" variant="outline">
                                    Cancel
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
