'use client';

import { useSession } from "next-auth/react";
import { useState, useEffect } from "react";
import { ChevronDown, Download, FileJson, FileSpreadsheet, Package, Plus, Tag as TagIcon, Upload } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Dialog, DialogContent } from "@/components/ui/Dialog";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/DropdownMenu";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import AssetRelations from "@/components/AssetRelations";
import { isValidIP, isValidMAC } from "@/lib/validation";
import { SkeletonTable, LoadingSpinner } from "@/components/Skeleton";
import BulkOperations from "@/components/BulkOperations";
import { useToast } from "@/components/ToastProvider";
import { ImportDialog } from "./_components/ImportDialog";
import { ItemFilters } from "./_components/ItemFilters";
import { ItemFormDialog } from "./_components/ItemFormDialog";
import { ItemsTable } from "./_components/ItemsTable";
import { TagsDialog } from "./_components/TagsDialog";
import type { AssetStatus, ConfigItem, ItemFormData, PaginationData, Tag, Type } from "./_components/types";

export default function ItemsPage() {
    const { data: session, status } = useSession();
    const { addToast } = useToast();
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
    
    // Bulk selection state
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [newTagDescription, setNewTagDescription] = useState("");

    // Dialog state (create/edit forms, import, tag deletion and item deletion confirmations)
    const [showCreateDialog, setShowCreateDialog] = useState(false);
    const [showImportDialog, setShowImportDialog] = useState(false);
    const [itemToDelete, setItemToDelete] = useState<ConfigItem | null>(null);
    const [tagToDelete, setTagToDelete] = useState<Tag | null>(null);
    const [loaded, setLoaded] = useState(false);

    // Relations modal state
    const [showRelationsModal, setShowRelationsModal] = useState(false);
    const [relationsItem, setRelationsItem] = useState<ConfigItem | null>(null);

    // Bulk selection handlers
    const toggleSelection = (id: string) => {
        setSelectedIds(prev =>
            prev.includes(id)
                ? prev.filter(itemId => itemId !== id)
                : [...prev, id]
        );
    };

    const toggleAllSelection = () => {
        if (selectedIds.length === items.length) {
            setSelectedIds([]);
        } else {
            setSelectedIds(items.map(item => item.id));
        }
    };

    const clearSelection = () => {
        setSelectedIds([]);
    };

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
        } finally {
            setLoaded(true);
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
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [session, pagination.page, debouncedSearch, selectedTypeId, statusFilter]);

    // Fetch types and tags on mount
    useEffect(() => {
        if (session) {
            fetchTypes();
            fetchTags();
        }
    }, [session]);

    const createItem = async () => {
        if (!newItem.name.trim()) {
            addToast({ type: "error", title: "Validation Error", message: "Name is required" });
            return;
        }
        // Validate IP and MAC before saving
        if (newItem.ip && !isValidIP(newItem.ip)) {
            addToast({ type: "error", title: "Validation Error", message: "Please enter a valid IP address" });
            return;
        }
        if (newItem.mac && !isValidMAC(newItem.mac)) {
            addToast({ type: "error", title: "Validation Error", message: "Please enter a valid MAC address" });
            return;
        }
        try {
            const res = await fetch("/api/configuration-items", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(newItem),
            });
            if (!res.ok) {
                const err = await res.json();
                addToast({ type: "error", title: "Failed to create item", message: err.error || res.statusText });
                return;
            }
            const created = await res.json();
            setItems((prev) => [created, ...prev]);
            setNewItem({ name: "", description: "", itemTypeId: "", ip: "", mac: "", status: "ACTIVE", tagIds: [] });
            addToast({ type: "success", title: "Item created", message: `"${created.name}" has been added successfully` });
            setShowCreateDialog(false);
            fetchItems();
        } catch (err) {
            addToast({ type: "error", title: "Network error", message: String(err) });
        }
    };

    const deleteItem = async (id: string) => {
        try {
            const res = await fetch(`/api/configuration-items/${id}`, { method: "DELETE" });
            if (!res.ok) {
                const err = await res.json();
                addToast({ type: "error", title: "Failed to delete item", message: err.error || res.statusText });
                return;
            }
            setItems((prev) => prev.filter((item) => item.id !== id));
            addToast({ type: "success", title: "Item deleted", message: "The item has been removed successfully" });
            fetchItems();
        } catch (err) {
            addToast({ type: "error", title: "Network error", message: String(err) });
        }
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
        // Validate IP and MAC before saving
        if (editingItemData.ip && !isValidIP(editingItemData.ip)) {
            addToast({ type: "error", title: "Validation Error", message: "Please enter a valid IP address" });
            return;
        }
        if (editingItemData.mac && !isValidMAC(editingItemData.mac)) {
            addToast({ type: "error", title: "Validation Error", message: "Please enter a valid MAC address" });
            return;
        }
        try {
            const res = await fetch(`/api/configuration-items/${id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(editingItemData),
            });
            if (!res.ok) {
                const err = await res.json();
                addToast({ type: "error", title: "Failed to update item", message: err.error || res.statusText });
                return;
            }
            const updated = await res.json();
            setItems((prev) => prev.map((item) => (item.id === id ? updated : item)));
            addToast({ type: "success", title: "Item updated", message: `"${updated.name}" has been updated successfully` });
            cancelEditing();
        } catch (err) {
            addToast({ type: "error", title: "Network error", message: String(err) });
        }
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
        if (!csvContent) {
            addToast({ type: "warning", title: "No file selected", message: "Please select a CSV file to upload" });
            return;
        }
        try {
            const res = await fetch("/api/configuration-items/upload", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ csv: csvContent }),
            });
            if (res.ok) {
                addToast({ type: "success", title: "CSV uploaded", message: "Items have been imported successfully" });
                setCsvContent("");
                setShowImportDialog(false);
                fetchItems();
            } else {
                const err = await res.json();
                addToast({ type: "error", title: "CSV upload failed", message: err.error || "Failed to import items" });
            }
        } catch (error) {
            addToast({ type: "error", title: "Upload error", message: String(error) });
        }
    };

    // Tag management
    const createTag = async () => {
        if (!newTagName.trim()) {
            addToast({ type: "warning", title: "Tag name required", message: "Please enter a name for the tag" });
            return;
        }
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
                addToast({ type: "success", title: "Tag created", message: `"${newTag.name}" has been created successfully` });
            } else {
                const err = await res.json();
                addToast({ type: "error", title: "Failed to create tag", message: err.error || "Could not create tag" });
            }
        } catch (error) {
            addToast({ type: "error", title: "Network error", message: String(error) });
        }
    };

    const deleteTag = async (tagId: string) => {
        try {
            const res = await fetch(`/api/tags/${tagId}`, { method: "DELETE" });
            if (res.ok) {
                setAvailableTags((prev) => prev.filter((t) => t.id !== tagId));
                addToast({ type: "success", title: "Tag deleted", message: "The tag has been removed successfully" });
            } else {
                const err = await res.json();
                addToast({ type: "error", title: "Failed to delete tag", message: err.error || "Could not delete tag" });
            }
        } catch (error) {
            addToast({ type: "error", title: "Network error", message: String(error) });
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

    const clearFilters = () => {
        setSearchQuery("");
        setSelectedTypeId("");
        setStatusFilter("ALL");
        setPagination(prev => ({ ...prev, page: 1 }));
    };

    // Export handlers
    const exportData = async (format: "json" | "csv") => {
        try {
            const params = new URLSearchParams({
                format,
                includeTags: "true",
            });
            if (selectedTypeId) params.append("typeId", selectedTypeId);
            if (statusFilter !== "ALL") params.append("status", statusFilter);

            const res = await fetch(`/api/configuration-items/export?${params.toString()}`);
            if (!res.ok) {
                console.error("Export failed:", await res.text());
                return;
            }

            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            const filename = res.headers.get("content-disposition")?.match(/filename="(.+)"/)?.[1] || `export.${format}`;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (error) {
            console.error("Export error:", error);
        }
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

    const statusOptionsForBulk: { value: AssetStatus; label: string }[] = [
        { value: "ACTIVE", label: "Active" },
        { value: "MAINTENANCE", label: "Maintenance" },
        { value: "DEPRECATED", label: "Deprecated" },
    ];

    const filtersActive = searchQuery !== "" || selectedTypeId !== "" || statusFilter !== "ALL";

    if (status === "loading") {
        return (
            <div>
                <LoadingSpinner size="lg" />
                <div className="mt-8">
                    <SkeletonTable rows={5} />
                </div>
            </div>
        );
    }

    return (
        <div>
            <PageHeader
                title="Items"
                description={`${pagination.total} configuration ${pagination.total === 1 ? "item" : "items"}`}
                actions={
                    <>
                        <Button variant="secondary" onClick={() => setShowTagModal(true)}>
                            <TagIcon className="size-4" aria-hidden="true" />
                            Tags
                        </Button>
                        <Button variant="secondary" onClick={() => setShowImportDialog(true)}>
                            <Upload className="size-4" aria-hidden="true" />
                            Import
                        </Button>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="secondary">
                                    <Download className="size-4" aria-hidden="true" />
                                    Export
                                    <ChevronDown className="size-4" aria-hidden="true" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem onSelect={() => exportData("json")}>
                                    <FileJson className="size-4" aria-hidden="true" />
                                    Export JSON
                                </DropdownMenuItem>
                                <DropdownMenuItem onSelect={() => exportData("csv")}>
                                    <FileSpreadsheet className="size-4" aria-hidden="true" />
                                    Export CSV
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                        <Button onClick={() => setShowCreateDialog(true)}>
                            <Plus className="size-4" aria-hidden="true" />
                            New item
                        </Button>
                    </>
                }
            />

            <ItemFilters
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                selectedTypeId={selectedTypeId}
                onTypeChange={(value) => {
                    setSelectedTypeId(value);
                    setPagination(prev => ({ ...prev, page: 1 }));
                }}
                statusFilter={statusFilter}
                onStatusChange={(value) => {
                    setStatusFilter(value);
                    setPagination(prev => ({ ...prev, page: 1 }));
                }}
                availableTypes={availableTypes}
                onClear={clearFilters}
            />

            {/* Bulk Operations */}
            <BulkOperations
                selectedIds={selectedIds}
                availableTags={availableTags}
                availableStatuses={statusOptionsForBulk}
                onClearSelection={clearSelection}
                onRefresh={fetchItems}
            />

            {/* Items Table */}
            {!loaded ? (
                <SkeletonTable rows={5} />
            ) : items.length === 0 ? (
                <EmptyState
                    icon={Package}
                    title={filtersActive ? "No items match your filters" : "No items yet"}
                    description={
                        filtersActive
                            ? "No items found. Try adjusting your search or filters."
                            : "Create your first configuration item or import a CSV file."
                    }
                    action={
                        filtersActive ? (
                            <Button variant="secondary" onClick={clearFilters}>
                                Clear filters
                            </Button>
                        ) : (
                            <Button onClick={() => setShowCreateDialog(true)}>
                                <Plus className="size-4" aria-hidden="true" />
                                New item
                            </Button>
                        )
                    }
                />
            ) : (
                <ItemsTable
                    items={items}
                    selectedIds={selectedIds}
                    onToggleSelection={toggleSelection}
                    onToggleAll={toggleAllSelection}
                    onEdit={startEditing}
                    onRelations={(item) => { setRelationsItem(item); setShowRelationsModal(true); }}
                    onDelete={setItemToDelete}
                    pagination={pagination}
                    paginationRange={getPaginationRange()}
                    onGoToPage={goToPage}
                />
            )}

            {/* New item */}
            <ItemFormDialog
                open={showCreateDialog}
                onOpenChange={setShowCreateDialog}
                title="New item"
                submitLabel="Add item"
                idPrefix="new-item"
                data={newItem}
                onChange={setNewItem}
                availableTypes={availableTypes}
                availableTags={availableTags}
                onToggleTag={(tagId) => toggleTagSelection(tagId, false)}
                onSubmit={createItem}
            />

            {/* Edit item */}
            <ItemFormDialog
                open={editingItemId !== null}
                onOpenChange={(open) => { if (!open) cancelEditing(); }}
                title="Edit item"
                submitLabel="Save"
                idPrefix="edit-item"
                data={editingItemData}
                onChange={setEditingItemData}
                availableTypes={availableTypes}
                availableTags={availableTags}
                onToggleTag={(tagId) => toggleTagSelection(tagId, true)}
                onSubmit={() => { if (editingItemId) updateItem(editingItemId); }}
            />

            {/* Import CSV */}
            <ImportDialog
                open={showImportDialog}
                onOpenChange={(open) => {
                    setShowImportDialog(open);
                    if (!open) setCsvContent("");
                }}
                onFileChange={handleCsvFileChange}
                onUpload={uploadCsv}
            />

            {/* Tags */}
            <TagsDialog
                open={showTagModal}
                onOpenChange={setShowTagModal}
                tags={availableTags}
                onRequestDelete={setTagToDelete}
                name={newTagName}
                onNameChange={setNewTagName}
                color={newTagColor}
                onColorChange={setNewTagColor}
                description={newTagDescription}
                onDescriptionChange={setNewTagDescription}
                onCreate={createTag}
            />

            <ConfirmDialog
                open={tagToDelete !== null}
                onOpenChange={(open) => { if (!open) setTagToDelete(null); }}
                title="Delete tag"
                description={`Are you sure you want to delete the tag "${tagToDelete?.name ?? ""}"?`}
                confirmLabel="Delete"
                tone="danger"
                onConfirm={() => { if (tagToDelete) deleteTag(tagToDelete.id); }}
            />

            <ConfirmDialog
                open={itemToDelete !== null}
                onOpenChange={(open) => { if (!open) setItemToDelete(null); }}
                title="Delete item"
                description={`Delete "${itemToDelete?.name ?? ""}"? This cannot be undone.`}
                confirmLabel="Delete"
                tone="danger"
                onConfirm={() => { if (itemToDelete) deleteItem(itemToDelete.id); }}
            />

            {/* Relations Modal */}
            <Dialog
                open={showRelationsModal && relationsItem !== null}
                onOpenChange={(open) => {
                    if (!open) {
                        setShowRelationsModal(false);
                        setRelationsItem(null);
                    }
                }}
            >
                <DialogContent
                    title={`Asset relations: ${relationsItem?.name ?? ""}`}
                    description="Manage relationships with other configuration items"
                    className="max-w-3xl"
                >
                    {relationsItem && (
                        <AssetRelations itemId={relationsItem.id} itemName={relationsItem.name} />
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
