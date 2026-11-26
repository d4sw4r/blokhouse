// components/BulkOperations.tsx
"use client";

import { useState } from "react";
import { AlertTriangle, Check, X } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Callout } from "@/components/ui/Callout";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { StatusDot } from "@/components/ui/StatusDot";
import { useToast } from "@/components/ToastProvider";
import { cn } from "@/lib/utils";
import { TagToggle } from "@/components/TagToggle";

interface Tag {
    id: string;
    name: string;
    color?: string | null;
}

type AssetStatus = "ACTIVE" | "DEPRECATED" | "MAINTENANCE";

interface BulkOperationsProps {
    selectedIds: string[];
    availableTags: Tag[];
    availableStatuses: { value: AssetStatus; label: string }[];
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
    const [confirming, setConfirming] = useState<"status" | "addTags" | "delete" | null>(null);
    const { addToast } = useToast();

    if (selectedIds.length === 0) return null;

    const handleStatusChange = async () => {
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
                addToast({ type: "error", title: "Bulk status update failed" });
            }
        } catch {
            addToast({ type: "error", title: "Network error" });
        } finally {
            setLoading(false);
        }
    };

    const handleAddTags = async () => {
        if (selectedTagIds.length === 0) return;
        setLoading(true);
        try {
            let failed = 0;
            // Add tags one by one for each item
            for (const itemId of selectedIds) {
                for (const tagId of selectedTagIds) {
                    const res = await fetch(`/api/configuration-items/${itemId}/tags`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ tagIds: [tagId] }),
                    });
                    if (!res.ok) failed++;
                }
            }
            if (failed > 0) addToast({ type: "error", title: "Some tags could not be added", message: `${failed} request(s) failed` });
            onClearSelection();
            onRefresh();
            setIsOpen(false);
            setOperation(null);
            setSelectedTagIds([]);
        } catch {
            addToast({ type: "error", title: "Network error" });
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async () => {
        setLoading(true);
        try {
            let failed = 0;
            for (const itemId of selectedIds) {
                const res = await fetch(`/api/configuration-items/${itemId}`, {
                    method: "DELETE",
                });
                if (!res.ok) failed++;
            }
            if (failed > 0) addToast({ type: "error", title: "Some items could not be deleted", message: `${failed} request(s) failed` });
            onClearSelection();
            onRefresh();
            setIsOpen(false);
            setOperation(null);
        } catch {
            addToast({ type: "error", title: "Network error" });
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

    const closePanel = () => {
        setIsOpen(false);
        setOperation(null);
    };

    const confirmCopy = {
        status: {
            title: "Change status",
            description: `Change status to "${selectedStatus}" for ${selectedIds.length} items?`,
            confirmLabel: "Change status",
            tone: undefined,
        },
        addTags: {
            title: "Add tags",
            description: `Add ${selectedTagIds.length} tag(s) to ${selectedIds.length} items?`,
            confirmLabel: "Add tags",
            tone: undefined,
        },
        delete: {
            title: "Delete items",
            description: `Delete ${selectedIds.length} items permanently? This cannot be undone!`,
            confirmLabel: "Delete items",
            tone: "danger" as const,
        },
    };
    const active = confirming ? confirmCopy[confirming] : null;

    return (
        <div className="mb-4 rounded-lg border border-border bg-surface-2 p-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <Badge tone="accent" className="font-mono">
                        {selectedIds.length} selected
                    </Badge>
                    <span className="text-sm text-muted">Bulk operations available</span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    {!isOpen && (
                        <>
                            <Button onClick={() => { setIsOpen(true); setOperation("status"); }} size="sm" variant="secondary">
                                Change Status
                            </Button>
                            <Button onClick={() => { setIsOpen(true); setOperation("addTags"); }} size="sm" variant="secondary">
                                Add Tags
                            </Button>
                            <Button onClick={() => { setIsOpen(true); setOperation("delete"); }} size="sm" variant="danger">
                                Delete
                            </Button>
                        </>
                    )}
                    <Button onClick={onClearSelection} size="sm" variant="ghost">
                        <X className="size-4" aria-hidden="true" />
                        Clear
                    </Button>
                </div>
            </div>

            {isOpen && (
                <div className="mt-3 border-t border-border pt-3">
                    {operation === "status" && (
                        <div className="space-y-3">
                            <span id="bulk-status-label" className="block text-sm font-medium text-text">
                                Change status to:
                            </span>
                            <div role="group" aria-labelledby="bulk-status-label" className="flex flex-wrap gap-2">
                                {availableStatuses.map((status) => (
                                    <button
                                        key={status.value}
                                        type="button"
                                        aria-pressed={selectedStatus === status.value}
                                        onClick={() => setSelectedStatus(status.value)}
                                        className={cn(
                                            "inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm transition-colors duration-150 motion-reduce:transition-none max-sm:min-h-11",
                                            selectedStatus === status.value
                                                ? "border-accent bg-accent/10"
                                                : "border-border-strong bg-surface hover:bg-surface-2",
                                        )}
                                    >
                                        {selectedStatus === status.value && (
                                            <Check className="size-3.5 text-accent" aria-hidden="true" />
                                        )}
                                        <StatusDot status={status.value} />
                                    </button>
                                ))}
                            </div>
                            <div className="flex gap-2 pt-1">
                                <Button onClick={() => setConfirming("status")} disabled={loading} size="sm" loading={loading}>
                                    {loading ? "Updating..." : "Apply"}
                                </Button>
                                <Button onClick={closePanel} size="sm" variant="secondary">
                                    Cancel
                                </Button>
                            </div>
                        </div>
                    )}

                    {operation === "addTags" && (
                        <div className="space-y-3">
                            <span id="bulk-tags-label" className="block text-sm font-medium text-text">
                                Select tags to add:
                            </span>
                            <div role="group" aria-labelledby="bulk-tags-label" className="flex flex-wrap gap-2">
                                {availableTags.map((tag) => (
                                    <TagToggle
                                        key={tag.id}
                                        tag={tag}
                                        selected={selectedTagIds.includes(tag.id)}
                                        onToggle={() => toggleTagSelection(tag.id)}
                                    />
                                ))}
                                {availableTags.length === 0 && (
                                    <span className="text-sm text-muted">No tags available</span>
                                )}
                            </div>
                            <div className="flex gap-2 pt-1">
                                <Button
                                    onClick={() => setConfirming("addTags")}
                                    disabled={loading || selectedTagIds.length === 0}
                                    size="sm"
                                    loading={loading}
                                >
                                    {loading ? "Adding..." : `Add ${selectedTagIds.length} Tag(s)`}
                                </Button>
                                <Button onClick={closePanel} size="sm" variant="secondary">
                                    Cancel
                                </Button>
                            </div>
                        </div>
                    )}

                    {operation === "delete" && (
                        <div className="space-y-3">
                            <Callout tone="danger" icon={AlertTriangle}>
                                <p className="font-medium">
                                    Warning: This will permanently delete {selectedIds.length} items!
                                </p>
                            </Callout>
                            <div className="flex gap-2">
                                <Button
                                    onClick={() => setConfirming("delete")}
                                    disabled={loading}
                                    size="sm"
                                    variant="danger"
                                    loading={loading}
                                >
                                    {loading ? "Deleting..." : "Confirm Delete"}
                                </Button>
                                <Button onClick={closePanel} size="sm" variant="secondary">
                                    Cancel
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            <ConfirmDialog
                open={confirming !== null}
                onOpenChange={(open) => {
                    if (!open) setConfirming(null);
                }}
                title={active?.title ?? ""}
                description={active?.description ?? ""}
                confirmLabel={active?.confirmLabel ?? "Confirm"}
                tone={active?.tone}
                onConfirm={() => {
                    if (confirming === "status") handleStatusChange();
                    else if (confirming === "addTags") handleAddTags();
                    else if (confirming === "delete") handleDelete();
                }}
            />
        </div>
    );
}
