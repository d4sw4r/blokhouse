'use client';

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/Button";
import Link from "next/link";
import { SkeletonCard, LoadingSpinner } from "@/components/Skeleton";

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
                alert(error.error || "Failed to delete tag");
            }
        } catch (error) {
            console.error("Error deleting tag:", error);
            alert("Network error");
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

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
                <main className="max-w-7xl mx-auto p-8">
                    <div className="flex justify-between items-center mb-8">
                        <h1 className="text-4xl font-bold text-gray-800 dark:text-white">Tags Management</h1>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                        <SkeletonCard />
                        <SkeletonCard />
                        <SkeletonCard />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {[1, 2, 3, 4, 5, 6].map(i => <SkeletonCard key={i} />)}
                    </div>
                </main>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
            <main className="max-w-7xl mx-auto p-8">
                {/* Header */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                    <div>
                        <h1 className="text-4xl font-bold text-gray-800 dark:text-white">Tags Management</h1>
                        <p className="text-gray-600 dark:text-gray-400 mt-2">
                            Organize and manage tags for your configuration items
                        </p>
                    </div>
                    <Button onClick={() => {
                        setFormData({ name: "", color: "#3b82f6", description: "" });
                        setFormErrors({});
                        setShowCreateModal(true);
                    }}>
                        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        Create Tag
                    </Button>
                </div>

                {/* Statistics */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Tags</p>
                                <p className="text-3xl font-bold text-brand-primary mt-1">{totalTags}</p>
                            </div>
                            <div className="p-3 bg-blue-100 dark:bg-blue-900 rounded-full">
                                <svg className="w-6 h-6 text-blue-600 dark:text-blue-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                                </svg>
                            </div>
                        </div>
                    </div>
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Tagged Items</p>
                                <p className="text-3xl font-bold text-green-600 mt-1">{totalTaggedItems}</p>
                            </div>
                            <div className="p-3 bg-green-100 dark:bg-green-900 rounded-full">
                                <svg className="w-6 h-6 text-green-600 dark:text-green-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                            </div>
                        </div>
                    </div>
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Unused Tags</p>
                                <p className="text-3xl font-bold text-orange-600 mt-1">{unusedTags}</p>
                            </div>
                            <div className="p-3 bg-orange-100 dark:bg-orange-900 rounded-full">
                                <svg className="w-6 h-6 text-orange-600 dark:text-orange-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Search */}
                <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm mb-6">
                    <div className="flex flex-col md:flex-row gap-4">
                        <div className="flex-1 relative">
                            <svg className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                            <input
                                type="text"
                                placeholder="Search tags by name or description..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                            />
                        </div>
                        {searchQuery && (
                            <Button onClick={() => setSearchQuery("")} variant="outline">
                                Clear Search
                            </Button>
                        )}
                    </div>
                </div>

                {/* Tags Grid */}
                {filteredTags.length === 0 ? (
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-12 text-center">
                        <svg className="w-16 h-16 mx-auto mb-4 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                        </svg>
                        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                            {searchQuery ? "No tags found" : "No tags yet"}
                        </h3>
                        <p className="text-gray-500 dark:text-gray-400 mb-4">
                            {searchQuery 
                                ? "Try adjusting your search query" 
                                : "Create your first tag to start organizing your assets"}
                        </p>
                        {!searchQuery && (
                            <Button onClick={() => setShowCreateModal(true)}>
                                Create Your First Tag
                            </Button>
                        )}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filteredTags.map((tag) => (
                            <div 
                                key={tag.id} 
                                className="bg-white dark:bg-gray-800 rounded-lg shadow-sm hover:shadow-md transition-shadow p-6"
                            >
                                <div className="flex items-start justify-between mb-4">
                                    <div 
                                        className="px-3 py-1 rounded-full text-sm font-medium"
                                        style={{
                                            backgroundColor: tag.color ? `${tag.color}20` : '#e5e7eb',
                                            color: tag.color || '#374151',
                                            border: `1px solid ${tag.color || '#d1d5db'}`
                                        }}
                                    >
                                        {tag.name}
                                    </div>
                                    <div className="flex gap-1">
                                        <button
                                            onClick={() => openEditModal(tag)}
                                            className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                                            title="Edit tag"
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                            </svg>
                                        </button>
                                        <button
                                            onClick={() => openDeleteModal(tag)}
                                            className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                                            title="Delete tag"
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                            </svg>
                                        </button>
                                    </div>
                                </div>
                                
                                {tag.description && (
                                    <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">
                                        {tag.description}
                                    </p>
                                )}
                                
                                <div className="flex items-center justify-between pt-4 border-t dark:border-gray-700">
                                    <div className="flex items-center gap-2">
                                        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                                        </svg>
                                        <span className="text-sm text-gray-600 dark:text-gray-400">
                                            {tag._count.configurationItems} {tag._count.configurationItems === 1 ? 'item' : 'items'}
                                        </span>
                                    </div>
                                    <Link 
                                        href={`/items?tag=${tag.id}`}
                                        className="text-sm text-brand-primary hover:text-brand-accent font-medium"
                                    >
                                        View Items →
                                    </Link>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Create Modal */}
                {showCreateModal && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full">
                            <div className="p-6 border-b dark:border-gray-700">
                                <h2 className="text-xl font-semibold text-gray-800 dark:text-white">Create New Tag</h2>
                            </div>
                            <div className="p-6 space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                        Name <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-brand-primary dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                        placeholder="e.g., production"
                                    />
                                    {formErrors.name && (
                                        <p className="text-red-500 text-sm mt-1">{formErrors.name}</p>
                                    )}
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                        Color
                                    </label>
                                    <div className="flex items-center gap-3">
                                        <input
                                            type="color"
                                            value={formData.color}
                                            onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                                            className="h-10 w-20 rounded cursor-pointer"
                                        />
                                        <input
                                            type="text"
                                            value={formData.color}
                                            onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                                            className="flex-1 border rounded-lg p-2 font-mono text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                            placeholder="#3b82f6"
                                        />
                                    </div>
                                    {formErrors.color && (
                                        <p className="text-red-500 text-sm mt-1">{formErrors.color}</p>
                                    )}
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                        Description
                                    </label>
                                    <textarea
                                        value={formData.description}
                                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                        className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-brand-primary dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                        rows={3}
                                        placeholder="Optional description for this tag"
                                    />
                                </div>
                                {formErrors.submit && (
                                    <p className="text-red-500 text-sm">{formErrors.submit}</p>
                                )}
                            </div>
                            <div className="p-6 border-t dark:border-gray-700 flex gap-3">
                                <Button onClick={handleCreate} disabled={submitting} className="flex-1">
                                    {submitting ? <LoadingSpinner size="sm" /> : "Create Tag"}
                                </Button>
                                <Button onClick={() => setShowCreateModal(false)} variant="outline" disabled={submitting}>
                                    Cancel
                                </Button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Edit Modal */}
                {showEditModal && selectedTag && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full">
                            <div className="p-6 border-b dark:border-gray-700">
                                <h2 className="text-xl font-semibold text-gray-800 dark:text-white">Edit Tag</h2>
                            </div>
                            <div className="p-6 space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                        Name <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-brand-primary dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                    />
                                    {formErrors.name && (
                                        <p className="text-red-500 text-sm mt-1">{formErrors.name}</p>
                                    )}
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                        Color
                                    </label>
                                    <div className="flex items-center gap-3">
                                        <input
                                            type="color"
                                            value={formData.color}
                                            onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                                            className="h-10 w-20 rounded cursor-pointer"
                                        />
                                        <input
                                            type="text"
                                            value={formData.color}
                                            onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                                            className="flex-1 border rounded-lg p-2 font-mono text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                        Description
                                    </label>
                                    <textarea
                                        value={formData.description}
                                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                        className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-brand-primary dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                        rows={3}
                                    />
                                </div>
                                {formErrors.submit && (
                                    <p className="text-red-500 text-sm">{formErrors.submit}</p>
                                )}
                            </div>
                            <div className="p-6 border-t dark:border-gray-700 flex gap-3">
                                <Button onClick={handleUpdate} disabled={submitting} className="flex-1">
                                    {submitting ? <LoadingSpinner size="sm" /> : "Save Changes"}
                                </Button>
                                <Button onClick={() => setShowEditModal(false)} variant="outline" disabled={submitting}>
                                    Cancel
                                </Button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Delete Modal */}
                {showDeleteModal && selectedTag && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full">
                            <div className="p-6 border-b dark:border-gray-700">
                                <h2 className="text-xl font-semibold text-gray-800 dark:text-white">Delete Tag</h2>
                            </div>
                            <div className="p-6">
                                <p className="text-gray-600 dark:text-gray-400 mb-4">
                                    Are you sure you want to delete the tag <strong>&quot;{selectedTag.name}&quot;</strong>?
                                </p>
                                {selectedTag._count.configurationItems > 0 && (
                                    <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-4">
                                        <p className="text-yellow-800 dark:text-yellow-200 text-sm">
                                            <strong>Warning:</strong> This tag is assigned to {selectedTag._count.configurationItems} {selectedTag._count.configurationItems === 1 ? 'item' : 'items'}. 
                                            Deleting it will remove the tag from all items.
                                        </p>
                                    </div>
                                )}
                            </div>
                            <div className="p-6 border-t dark:border-gray-700 flex gap-3">
                                <Button onClick={handleDelete} disabled={submitting} variant="destructive" className="flex-1">
                                    {submitting ? <LoadingSpinner size="sm" /> : "Delete Tag"}
                                </Button>
                                <Button onClick={() => setShowDeleteModal(false)} variant="outline" disabled={submitting}>
                                    Cancel
                                </Button>
                            </div>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}
