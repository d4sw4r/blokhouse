'use client';

import { useState, useEffect } from "react";
import Link from "next/link";
import { Box, Pencil, Plus, Search, Tag as TagIcon, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Callout } from "@/components/ui/Callout";
import { Dialog, DialogContent } from "@/components/ui/Dialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field } from "@/components/ui/Field";
import { IconButton } from "@/components/ui/IconButton";
import { Input } from "@/components/ui/Input";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatTile } from "@/components/ui/StatTile";
import { Textarea } from "@/components/ui/Textarea";
import { TagBadge } from "@/components/TagBadge";
import { SkeletonCard } from "@/components/Skeleton";
import { useToast } from "@/components/ToastProvider";

interface Tag {
    id: string;
    name: string;
    color: string | null;
    description: string | null;
    createdAt: string;
    _count: {
        configurationItems: number;
    };
}

export default function TagsPage() {
    const { addToast } = useToast();
    const [tags, setTags] = useState<Tag[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    
    // Modal states
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [selectedTag, setSelectedTag] = useState<Tag | null>(null);
    
    // Form states
    const [formData, setFormData] = useState({
        name: "",
        color: "#3b82f6",
        description: "",
    });
    const [formErrors, setFormErrors] = useState<{[key: string]: string}>({});
    const [submitting, setSubmitting] = useState(false);

    const fetchTags = async () => {
        try {
            setLoading(true);
            const res = await fetch("/api/tags");
            if (res.ok) {
                const data = await res.json();
                setTags(data);
            } else {
                console.error("Failed to fetch tags:", await res.text());
            }
        } catch (error) {
            console.error("Error fetching tags:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTags();
    }, []);

    const validateForm = () => {
        const errors: {[key: string]: string} = {};
        if (!formData.name.trim()) {
            errors.name = "Tag name is required";
        }
        if (formData.color && !/^#[0-9A-Fa-f]{6}$/.test(formData.color)) {
            errors.color = "Invalid hex color format";
        }
        setFormErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const handleCreate = async () => {
        if (!validateForm()) return;
        
        setSubmitting(true);
        try {
            const res = await fetch("/api/tags", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(formData),
            });
            
            if (res.ok) {
                await fetchTags();
                setShowCreateModal(false);
                setFormData({ name: "", color: "#3b82f6", description: "" });
                setFormErrors({});
            } else {
                const error = await res.json();
                setFormErrors({ submit: error.error || "Failed to create tag" });
            }
        } catch (error) {
            console.error("Error creating tag:", error);
            setFormErrors({ submit: "Network error" });
        } finally {
            setSubmitting(false);
        }
    };

    const handleUpdate = async () => {
        if (!selectedTag || !validateForm()) return;
        
        setSubmitting(true);
        try {
            const res = await fetch(`/api/tags/${selectedTag.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(formData),
            });
            
            if (res.ok) {
                await fetchTags();
                setShowEditModal(false);
                setSelectedTag(null);
                setFormData({ name: "", color: "#3b82f6", description: "" });
                setFormErrors({});
            } else {
                const error = await res.json();
                setFormErrors({ submit: error.error || "Failed to update tag" });
            }
        } catch (error) {
            console.error("Error updating tag:", error);
            setFormErrors({ submit: "Network error" });
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async () => {
        if (!selectedTag) return;
        
        setSubmitting(true);
        try {
            const res = await fetch(`/api/tags/${selectedTag.id}`, {
                method: "DELETE",
            });
            
            if (res.ok) {
                await fetchTags();
                setShowDeleteModal(false);
                setSelectedTag(null);
            } else {
                const error = await res.json();
                addToast({ type: "error", title: "Error", message: error.error || "Failed to delete tag" });
            }
        } catch (error) {
            console.error("Error deleting tag:", error);
            addToast({ type: "error", title: "Error", message: "Network error" });
        } finally {
            setSubmitting(false);
        }
    };

    const openEditModal = (tag: Tag) => {
        setSelectedTag(tag);
        setFormData({
            name: tag.name,
            color: tag.color || "#3b82f6",
            description: tag.description || "",
        });
        setFormErrors({});
        setShowEditModal(true);
    };

    const openDeleteModal = (tag: Tag) => {
        setSelectedTag(tag);
        setShowDeleteModal(true);
    };

    const filteredTags = tags.filter(tag =>
        tag.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (tag.description && tag.description.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    // Calculate statistics
    const totalTags = tags.length;
    const totalTaggedItems = tags.reduce((sum, tag) => sum + tag._count.configurationItems, 0);
    const unusedTags = tags.filter(tag => tag._count.configurationItems === 0).length;

    const openCreateModal = () => {
        setFormData({ name: "", color: "#3b82f6", description: "" });
        setFormErrors({});
        setShowCreateModal(true);
    };

    const tagForm = (idPrefix: string, withPlaceholders: boolean) => (
        <div className="space-y-4">
            <Field label="Name *" htmlFor={`${idPrefix}-name`} error={formErrors.name}>
                <Input
                    id={`${idPrefix}-name`}
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder={withPlaceholders ? "e.g., production" : undefined}
                />
            </Field>
            <Field label="Color" htmlFor={`${idPrefix}-color`} error={formErrors.color}>
                <div className="flex items-center gap-3">
                    <input
                        type="color"
                        aria-label="Pick a colour"
                        value={formData.color}
                        onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                        className="h-9 w-16 shrink-0 cursor-pointer rounded-md border border-border-strong bg-surface p-1 max-sm:h-11"
                    />
                    <Input
                        id={`${idPrefix}-color`}
                        type="text"
                        value={formData.color}
                        onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                        className="min-w-0 flex-1 font-mono"
                        placeholder={withPlaceholders ? "#3b82f6" : undefined}
                    />
                </div>
            </Field>
            <Field label="Description" htmlFor={`${idPrefix}-description`}>
                <Textarea
                    id={`${idPrefix}-description`}
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={3}
                    placeholder={withPlaceholders ? "Optional description for this tag" : undefined}
                />
            </Field>
            {formErrors.submit && (
                <p role="alert" className="text-sm text-danger">{formErrors.submit}</p>
            )}
        </div>
    );

    if (loading) {
        return (
            <div>
                <PageHeader title="Tags Management" />
                <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
                    <SkeletonCard />
                    <SkeletonCard />
                    <SkeletonCard />
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {[1, 2, 3, 4, 5, 6].map(i => <SkeletonCard key={i} />)}
                </div>
            </div>
        );
    }

    return (
        <div>
            <PageHeader
                title="Tags Management"
                description="Organize and manage tags for your configuration items"
                actions={
                    <Button onClick={openCreateModal}>
                        <Plus className="size-4" aria-hidden="true" />
                        Create Tag
                    </Button>
                }
            />

            {/* Statistics */}
            <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
                <StatTile label="Total Tags" value={totalTags} />
                <StatTile label="Tagged Items" value={totalTaggedItems} />
                <StatTile label="Unused Tags" value={unusedTags} tone={unusedTags > 0 ? "warning" : "neutral"} />
            </div>

            {/* Search */}
            <div className="mb-4 flex flex-wrap items-center gap-2">
                <div className="relative min-w-0 flex-1 sm:max-w-md">
                    <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" aria-hidden="true" />
                    <Input
                        type="text"
                        aria-label="Search tags"
                        placeholder="Search tags by name or description..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9"
                    />
                </div>
                {searchQuery && (
                    <Button onClick={() => setSearchQuery("")} variant="secondary">
                        Clear Search
                    </Button>
                )}
            </div>

            {/* Tags Grid */}
            {filteredTags.length === 0 ? (
                <EmptyState
                    icon={TagIcon}
                    title={searchQuery ? "No tags found" : "No tags yet"}
                    description={
                        searchQuery
                            ? "Try adjusting your search query"
                            : "Create your first tag to start organizing your assets"
                    }
                    action={
                        !searchQuery ? (
                            <Button onClick={openCreateModal}>Create Your First Tag</Button>
                        ) : undefined
                    }
                />
            ) : (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {filteredTags.map((tag) => (
                        <div
                            key={tag.id}
                            className="min-w-0 rounded-lg border border-border bg-surface p-4"
                        >
                            <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                    <TagBadge tag={tag} />
                                </div>
                                <div className="-mt-1 -mr-2 flex shrink-0 gap-0.5">
                                    <IconButton label={`Edit tag ${tag.name}`} icon={Pencil} onClick={() => openEditModal(tag)} />
                                    <IconButton label={`Delete tag ${tag.name}`} icon={Trash2} onClick={() => openDeleteModal(tag)} />
                                </div>
                            </div>

                            {tag.description && (
                                <p className="mt-3 text-sm break-words text-muted">{tag.description}</p>
                            )}

                            <div className="mt-4 flex items-center justify-between gap-2 border-t border-border pt-3">
                                <div className="flex items-center gap-2 text-sm text-muted">
                                    <Box className="size-4" aria-hidden="true" />
                                    <span>
                                        <span className="font-mono tabular-nums">{tag._count.configurationItems}</span>{" "}
                                        {tag._count.configurationItems === 1 ? "item" : "items"}
                                    </span>
                                </div>
                                <Link
                                    href={`/items?tag=${tag.id}`}
                                    className="text-sm font-medium text-accent hover:underline max-sm:inline-flex max-sm:min-h-11 max-sm:items-center"
                                >
                                    View Items →
                                </Link>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Create Modal */}
            <Dialog open={showCreateModal} onOpenChange={(o) => { if (!submitting) setShowCreateModal(o); }}>
                <DialogContent
                    title="Create New Tag"
                    footer={
                        <>
                            <Button onClick={() => setShowCreateModal(false)} variant="secondary" disabled={submitting}>
                                Cancel
                            </Button>
                            <Button onClick={handleCreate} loading={submitting}>
                                Create Tag
                            </Button>
                        </>
                    }
                >
                    {tagForm("create-tag", true)}
                </DialogContent>
            </Dialog>

            {/* Edit Modal */}
            <Dialog open={showEditModal && !!selectedTag} onOpenChange={(o) => { if (!submitting) setShowEditModal(o); }}>
                <DialogContent
                    title="Edit Tag"
                    footer={
                        <>
                            <Button onClick={() => setShowEditModal(false)} variant="secondary" disabled={submitting}>
                                Cancel
                            </Button>
                            <Button onClick={handleUpdate} loading={submitting}>
                                Save Changes
                            </Button>
                        </>
                    }
                >
                    {tagForm("edit-tag", false)}
                </DialogContent>
            </Dialog>

            {/* Delete Modal */}
            <Dialog open={showDeleteModal && !!selectedTag} onOpenChange={(o) => { if (!submitting) setShowDeleteModal(o); }}>
                <DialogContent
                    title="Delete Tag"
                    footer={
                        <>
                            <Button onClick={() => setShowDeleteModal(false)} variant="secondary" disabled={submitting}>
                                Cancel
                            </Button>
                            <Button onClick={handleDelete} variant="danger" loading={submitting}>
                                Delete Tag
                            </Button>
                        </>
                    }
                >
                    {selectedTag && (
                        <div className="space-y-4">
                            <p className="text-sm break-words text-text">
                                Are you sure you want to delete the tag <strong>&quot;{selectedTag.name}&quot;</strong>?
                            </p>
                            {selectedTag._count.configurationItems > 0 && (
                                <Callout tone="warning">
                                    <p>
                                        <strong>Warning:</strong> This tag is assigned to {selectedTag._count.configurationItems} {selectedTag._count.configurationItems === 1 ? "item" : "items"}.{" "}
                                        Deleting it will remove the tag from all items.
                                    </p>
                                </Callout>
                            )}
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
