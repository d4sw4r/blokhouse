'use client';

import { useSession } from "next-auth/react";
import { Suspense, useState, useEffect, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
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
import { DEFAULT_TAG_COLOR } from "@/components/TagForm";
import { TagsDialog } from "./_components/TagsDialog";
import { statusOptions, type AssetStatus, type ConfigItem, PaginationData, Tag, Type } from "./_components/types";
import {
    DEFAULT_ITEMS_QUERY,
    defaultOrder,
    parseItemsQuery,
    serializeItemsQuery,
    toApiParams,
    type ItemSort,
    type ItemsQuery,
} from "@/lib/ui/itemsQuery";

function ItemsPageFallback() {
    return (
        <div>
            <LoadingSpinner size="xl" />
            <div className="mt-8">
                <SkeletonTable rows={5} />
            </div>
        </div>
    );
}

// useSearchParams needs a Suspense boundary so the rest of the route can be prerendered.
export default function ItemsPage() {
    return (
        <Suspense fallback={<ItemsPageFallback />}>
            <ItemsPageContent />
        </Suspense>
    );
}

function ItemsPageContent() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    // The URL is the source of truth for search, filters, sort, page and page size.
    const query = parseItemsQuery(new URLSearchParams(searchParams.toString()));
    const apiQueryString = toApiParams(query).toString();
    const { addToast } = useToast();
    const [items, setItems] = useState<ConfigItem[]>([]);
    const [availableTypes, setAvailableTypes] = useState<Type[]>([]);
    const [typesLoaded, setTypesLoaded] = useState(false);
    const [availableTags, setAvailableTags] = useState<Tag[]>([]);
    const [tagsLoaded, setTagsLoaded] = useState(false);
    const [pagination, setPagination] = useState<PaginationData>({
        total: 0,
        page: DEFAULT_ITEMS_QUERY.page,
        limit: DEFAULT_ITEMS_QUERY.limit,
        totalPages: 1,
    });

    // The search box keeps its own state and is written to the URL after a 300 ms pause.
    const [searchInput, setSearchInput] = useState(query.search);
    // The search value this page last wrote to the URL, while that navigation has not landed yet.
    const [pendingSearch, setPendingSearch] = useState<string | null>(null);
    const [urlSearch, setUrlSearch] = useState(query.search);
    if (urlSearch !== query.search) {
        setUrlSearch(query.search);
        if (pendingSearch === null) {
            // A change from outside the search box (back/forward button, a link): show it.
            setSearchInput(query.search);
        } else if (query.search === pendingSearch) {
            // Our own write landed. Keep the box as it is: the user may have typed on meanwhile.
            setPendingSearch(null);
        }
        // Otherwise an older write of ours landed while a newer one is in flight: ignore it.
    }
    // Only the latest list request may update the table.
    const latestRequest = useRef(0);

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
    const [newTagColor, setNewTagColor] = useState(DEFAULT_TAG_COLOR);
    
    // Bulk selection state
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    // A different list query shows other rows: drop the selection so no hidden item stays
    // selected for bulk actions.
    const [selectionQuery, setSelectionQuery] = useState(apiQueryString);
    if (selectionQuery !== apiQueryString) {
        setSelectionQuery(apiQueryString);
        setSelectedIds([]);
    }
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

    /**
     * Writes a query change to the URL. Any change other than the page itself resets the page to 1.
     * User actions push a history entry so the back button restores the previous view; corrections
     * (an out-of-range page) replace the current entry.
     */
    const setQuery = (patch: Partial<ItemsQuery>, mode: "push" | "replace" = "push") => {
        // Build on the live URL. A debounced search write that has not landed yet is not in it,
        // so add that (other in-flight changes are not tracked: a click right after another
        // filter change may build on the URL before that change).
        const current = parseItemsQuery(new URLSearchParams(window.location.search));
        if (pendingSearch !== null) current.search = pendingSearch;
        const next: ItemsQuery = { ...current, ...patch, page: patch.page ?? 1 };
        if (patch.search !== undefined) setPendingSearch(next.search !== query.search ? next.search : null);
        const qs = serializeItemsQuery(next);
        const href = pathname + (qs ? "?" + qs : "");
        if (mode === "replace") router.replace(href, { scroll: false });
        else router.push(href, { scroll: false });
    };

    const fetchItems = async () => {
        const requestId = ++latestRequest.current;
        try {
            const res = await fetch(`/api/configuration-items?${apiQueryString}`);
            if (requestId !== latestRequest.current) return;
            if (!res.ok) {
                console.error("API Error:", await res.text());
                return;
            }
            const data = await res.json();
            if (requestId !== latestRequest.current) return;
            setItems(data.items || []);
            setPagination(data.pagination || { total: 0, page: 1, limit: query.limit, totalPages: 1 });
            // The requested page no longer exists (e.g. its last item was deleted): go to the last page
            if ((data.items || []).length === 0 && query.page > 1) {
                setQuery({ page: Math.max(1, data.pagination?.totalPages ?? 1) }, "replace");
            }
        } catch (err) {
            console.error("Fetch error:", err);
        } finally {
            if (requestId === latestRequest.current) setLoaded(true);
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
        } finally {
            setTypesLoaded(true);
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
        } finally {
            setTagsLoaded(true);
        }
    };

    // Debounce the search box into the URL (one history entry per pause of 300 ms in typing)
    useEffect(() => {
        if (searchInput === (pendingSearch ?? query.search)) return;
        const timer = setTimeout(() => setQuery({ search: searchInput }), 300);
        return () => clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchInput, pendingSearch, query.search]);

    // Fetch items when the session or the list query in the URL changes
    useEffect(() => {
        if (session) {
            fetchItems();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [session, apiQueryString]);

    // Fetch types and tags on mount
    useEffect(() => {
        if (session) {
            fetchTypes();
            fetchTags();
        }
    }, [session]);

    const createItem = async () => {
        if (!newItem.name.trim()) {
            addToast({ type: "error", title: "Validation error", message: "Name is required" });
            return;
        }
        // Validate IP and MAC before saving
        if (newItem.ip && !isValidIP(newItem.ip)) {
            addToast({ type: "error", title: "Validation error", message: "Please enter a valid IP address" });
            return;
        }
        if (newItem.mac && !isValidMAC(newItem.mac)) {
            addToast({ type: "error", title: "Validation error", message: "Please enter a valid MAC address" });
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
            addToast({ type: "error", title: "Validation error", message: "Please enter a valid IP address" });
            return;
        }
        if (editingItemData.mac && !isValidMAC(editingItemData.mac)) {
            addToast({ type: "error", title: "Validation error", message: "Please enter a valid MAC address" });
            return;
        }
        try {
            const res = await fetch(`/api/configuration-items/${id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ...editingItemData, itemTypeId: editingItemData.itemTypeId || null }),
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
                setNewTagColor(DEFAULT_TAG_COLOR);
                setNewTagDescription("");
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
        setSearchInput("");
        // Mark the empty search as written so the debounce does not write it again.
        setPendingSearch(query.search !== "" ? "" : null);
        router.push(pathname, { scroll: false });
    };

    const changeSort = (sort: ItemSort) => {
        if (sort === query.sort) {
            setQuery({ order: query.order === "asc" ? "desc" : "asc" });
        } else {
            setQuery({ sort, order: defaultOrder(sort) });
        }
    };

    // Export handlers
    const exportData = async (format: "json" | "csv") => {
        try {
            const params = new URLSearchParams({
                format,
                includeTags: "true",
            });
            if (query.search) params.append("search", query.search);
            if (query.typeId) params.append("typeId", query.typeId);
            if (query.status !== "ALL") params.append("status", query.status);
            if (query.tagId) params.append("tagId", query.tagId);

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
            setQuery({ page });
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


    const filtersActive =
        searchInput !== "" || query.search !== "" || query.typeId !== "" || query.status !== "ALL" || query.tagId !== "";

    if (status === "loading") {
        return <ItemsPageFallback />;
    }

    return (
        <div>
            <PageHeader
                title="Items"
                description={<><span className="font-mono">{pagination.total}</span> configuration {pagination.total === 1 ? "item" : "items"}</>}
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
                searchQuery={searchInput}
                onSearchChange={setSearchInput}
                // A type id that no longer exists shows "All types" (the URL is left as it is)
                selectedTypeId={typesLoaded && !availableTypes.some((t) => t.id === query.typeId) ? "" : query.typeId}
                onTypeChange={(typeId) => setQuery({ typeId })}
                statusFilter={query.status}
                onStatusChange={(value) => setQuery({ status: value })}
                // A tag id that no longer exists shows "All tags" (the URL is left as it is)
                selectedTagId={tagsLoaded && !availableTags.some((t) => t.id === query.tagId) ? "" : query.tagId}
                onTagChange={(tagId) => setQuery({ tagId })}
                availableTypes={availableTypes}
                availableTags={availableTags}
                onClear={clearFilters}
            />

            {/* Bulk Operations */}
            <BulkOperations
                selectedIds={selectedIds}
                availableTags={availableTags}
                availableStatuses={statusOptions}
                onClearSelection={clearSelection}
                onRefresh={fetchItems}
            />

            {/* Items Table */}
            {!loaded ? (
                <SkeletonTable rows={5} />
            ) : items.length === 0 && pagination.total === 0 && !filtersActive ? (
                <EmptyState
                    icon={Package}
                    title="No items yet"
                    description="Create your first configuration item or import a CSV file."
                    action={
                        <Button onClick={() => setShowCreateDialog(true)}>
                            <Plus className="size-4" aria-hidden="true" />
                            New item
                        </Button>
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
                    pageSize={query.limit}
                    onPageSizeChange={(limit) => setQuery({ limit })}
                    sort={query.sort}
                    order={query.order}
                    onSort={changeSort}
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
