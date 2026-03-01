"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { SkeletonCard, SkeletonTable } from "@/components/Skeleton";
import Link from "next/link";

interface MaintenanceSchedule {
    id: string;
    title: string;
    description: string | null;
    scheduledDate: string;
    completedDate: string | null;
    status: "SCHEDULED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
    priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
    assignedTo: string | null;
    createdAt: string;
    configurationItem: {
        id: string;
        name: string;
        status: string;
        itemType: { name: string } | null;
    };
}

const statusColors: Record<string, string> = {
    SCHEDULED: "bg-blue-100 text-blue-800",
    IN_PROGRESS: "bg-yellow-100 text-yellow-800",
    COMPLETED: "bg-green-100 text-green-800",
    CANCELLED: "bg-gray-100 text-gray-800",
};

const priorityColors: Record<string, string> = {
    LOW: "bg-green-100 text-green-800",
    MEDIUM: "bg-blue-100 text-blue-800",
    HIGH: "bg-orange-100 text-orange-800",
    CRITICAL: "bg-red-100 text-red-800",
};

export default function MaintenancePage() {
    const [schedules, setSchedules] = useState<MaintenanceSchedule[]>([]);
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState<string>("ALL");
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [selectedSchedule, setSelectedSchedule] = useState<MaintenanceSchedule | null>(null);

    // Form states
    const [formData, setFormData] = useState({
        configurationItemId: "",
        title: "",
        description: "",
        scheduledDate: "",
        priority: "MEDIUM",
        assignedTo: "",
    });
    const [availableItems, setAvailableItems] = useState<{ id: string; name: string }[]>([]);

    useEffect(() => {
        fetchSchedules();
        fetchItems();
    }, [statusFilter]);

    const fetchSchedules = async () => {
        try {
            setLoading(true);
            const params = new URLSearchParams();
            if (statusFilter !== "ALL") params.append("status", statusFilter);
            params.append("limit", "100");

            const res = await fetch(`/api/maintenance?${params.toString()}`);
            if (res.ok) {
                const data = await res.json();
                setSchedules(data.schedules);
            }
        } catch (error) {
            console.error("Error fetching schedules:", error);
        } finally {
            setLoading(false);
        }
    };

    const fetchItems = async () => {
        try {
            const res = await fetch("/api/configuration-items?limit=1000");
            if (res.ok) {
                const data = await res.json();
                setAvailableItems(data.items || []);
            }
        } catch (error) {
            console.error("Error fetching items:", error);
        }
    };

    const createSchedule = async () => {
        if (!formData.configurationItemId || !formData.title || !formData.scheduledDate) {
            alert("Please fill in all required fields");
            return;
        }

        try {
            const res = await fetch("/api/maintenance", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(formData),
            });

            if (res.ok) {
                setShowCreateModal(false);
                setFormData({
                    configurationItemId: "",
                    title: "",
                    description: "",
                    scheduledDate: "",
                    priority: "MEDIUM",
                    assignedTo: "",
                });
                fetchSchedules();
            } else {
                const err = await res.json();
                alert(`Error: ${err.error}`);
            }
        } catch (error) {
            console.error("Error creating schedule:", error);
        }
    };

    const updateStatus = async (id: string, newStatus: string) => {
        try {
            const body: { status: string; completedDate?: string } = { status: newStatus };
            if (newStatus === "COMPLETED") {
                body.completedDate = new Date().toISOString();
            }

            const res = await fetch(`/api/maintenance/${id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });

            if (res.ok) {
                fetchSchedules();
            }
        } catch (error) {
            console.error("Error updating schedule:", error);
        }
    };

    const deleteSchedule = async (id: string) => {
        if (!confirm("Are you sure you want to delete this maintenance schedule?")) return;

        try {
            const res = await fetch(`/api/maintenance/${id}`, {
                method: "DELETE",
            });

            if (res.ok) {
                fetchSchedules();
            }
        } catch (error) {
            console.error("Error deleting schedule:", error);
        }
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleString();
    };

    const isOverdue = (dateString: string) => {
        return new Date(dateString) < new Date();
    };

    const stats = {
        total: schedules.length,
        scheduled: schedules.filter((s) => s.status === "SCHEDULED").length,
        inProgress: schedules.filter((s) => s.status === "IN_PROGRESS").length,
        completed: schedules.filter((s) => s.status === "COMPLETED").length,
        overdue: schedules.filter((s) => s.status === "SCHEDULED" && isOverdue(s.scheduledDate)).length,
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50">
                <main className="max-w-7xl mx-auto p-8">
                    <h1 className="text-4xl font-bold text-gray-800 mb-8">Maintenance Schedule</h1>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                        {[...Array(4)].map((_, i) => (
                            <SkeletonCard key={i} />
                        ))}
                    </div>
                    <SkeletonTable rows={5} />
                </main>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">
            <main className="max-w-7xl mx-auto p-8">
                {/* Header */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                    <div>
                        <h1 className="text-4xl font-bold text-gray-800">Maintenance Schedule</h1>
                        <p className="text-gray-600 mt-1">Manage and track maintenance tasks for your assets</p>
                    </div>
                    <Button onClick={() => setShowCreateModal(true)}>+ Schedule Maintenance</Button>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
                    <div className="bg-white p-4 rounded-lg shadow-sm">
                        <p className="text-sm font-medium text-gray-600">Total Tasks</p>
                        <p className="text-2xl font-bold text-brand-primary">{stats.total}</p>
                    </div>
                    <div className="bg-white p-4 rounded-lg shadow-sm">
                        <p className="text-sm font-medium text-gray-600">Scheduled</p>
                        <p className="text-2xl font-bold text-blue-600">{stats.scheduled}</p>
                    </div>
                    <div className="bg-white p-4 rounded-lg shadow-sm">
                        <p className="text-sm font-medium text-gray-600">In Progress</p>
                        <p className="text-2xl font-bold text-yellow-600">{stats.inProgress}</p>
                    </div>
                    <div className="bg-white p-4 rounded-lg shadow-sm">
                        <p className="text-sm font-medium text-gray-600">Completed</p>
                        <p className="text-2xl font-bold text-green-600">{stats.completed}</p>
                    </div>
                    <div className="bg-white p-4 rounded-lg shadow-sm">
                        <p className="text-sm font-medium text-gray-600">Overdue</p>
                        <p className={`text-2xl font-bold ${stats.overdue > 0 ? "text-red-600" : "text-gray-600"}`}>
                            {stats.overdue}
                        </p>
                    </div>
                </div>

                {/* Filter */}
                <div className="bg-white p-4 rounded-lg shadow-sm mb-6">
                    <div className="flex items-center gap-4">
                        <label className="text-sm font-medium text-gray-600">Filter by Status:</label>
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="border rounded-lg px-3 py-2"
                        >
                            <option value="ALL">All</option>
                            <option value="SCHEDULED">Scheduled</option>
                            <option value="IN_PROGRESS">In Progress</option>
                            <option value="COMPLETED">Completed</option>
                            <option value="CANCELLED">Cancelled</option>
                        </select>
                    </div>
                </div>

                {/* Schedules Table */}
                <div className="bg-white rounded-lg shadow-sm overflow-hidden">
                    {schedules.length === 0 ? (
                        <div className="p-12 text-center text-gray-500">
                            <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                            </svg>
                            <h3 className="text-lg font-medium mb-2">No Maintenance Tasks</h3>
                            <p className="text-sm">Create your first maintenance schedule to get started</p>
                        </div>
                    ) : (
                        <table className="min-w-full">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="py-3 px-4 text-left text-sm font-medium text-gray-600">Task</th>
                                    <th className="py-3 px-4 text-left text-sm font-medium text-gray-600">Asset</th>
                                    <th className="py-3 px-4 text-left text-sm font-medium text-gray-600">Scheduled Date</th>
                                    <th className="py-3 px-4 text-left text-sm font-medium text-gray-600">Priority</th>
                                    <th className="py-3 px-4 text-left text-sm font-medium text-gray-600">Status</th>
                                    <th className="py-3 px-4 text-left text-sm font-medium text-gray-600">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                                {schedules.map((schedule) => (
                                    <tr key={schedule.id} className="hover:bg-gray-50">
                                        <td className="py-3 px-4">
                                            <div>
                                                <p className="font-medium text-gray-800">{schedule.title}</p>
                                                {schedule.description && (
                                                    <p className="text-sm text-gray-500">{schedule.description}</p>
                                                )}
                                            </div>
                                        </td>
                                        <td className="py-3 px-4">
                                            <Link
                                                href={`/items/${schedule.configurationItem.id}`}
                                                className="text-brand-primary hover:underline"
                                            >
                                                {schedule.configurationItem.name}
                                            </Link>
                                        </td>
                                        <td className="py-3 px-4">
                                            <span className={isOverdue(schedule.scheduledDate) && schedule.status === "SCHEDULED" ? "text-red-600 font-medium" : ""}>
                                                {formatDate(schedule.scheduledDate)}
                                                {isOverdue(schedule.scheduledDate) && schedule.status === "SCHEDULED" && (
                                                    <span className="ml-2 text-xs bg-red-100 text-red-800 px-2 py-0.5 rounded">Overdue</span>
                                                )}
                                            </span>
                                        </td>
                                        <td className="py-3 px-4">
                                            <span className={`px-2 py-1 rounded text-xs font-medium ${priorityColors[schedule.priority]}`}>
                                                {schedule.priority}
                                            </span>
                                        </td>
                                        <td className="py-3 px-4">
                                            <span className={`px-2 py-1 rounded text-xs font-medium ${statusColors[schedule.status]}`}>
                                                {schedule.status.replace("_", " ")}
                                            </span>
                                        </td>
                                        <td className="py-3 px-4">
                                            <div className="flex gap-2">
                                                {schedule.status === "SCHEDULED" && (
                                                    <Button
                                                        onClick={() => updateStatus(schedule.id, "IN_PROGRESS")}
                                                        size="sm"
                                                        variant="outline"
                                                    >
                                                        Start
                                                    </Button>
                                                )}
                                                {schedule.status === "IN_PROGRESS" && (
                                                    <Button
                                                        onClick={() => updateStatus(schedule.id, "COMPLETED")}
                                                        size="sm"
                                                        className="bg-green-600 hover:bg-green-700 text-white"
                                                    >
                                                        Complete
                                                    </Button>
                                                )}
                                                {schedule.status !== "COMPLETED" && schedule.status !== "CANCELLED" && (
                                                    <Button
                                                        onClick={() => updateStatus(schedule.id, "CANCELLED")}
                                                        size="sm"
                                                        variant="outline"
                                                    >
                                                        Cancel
                                                    </Button>
                                                )}
                                                <Button
                                                    onClick={() => deleteSchedule(schedule.id)}
                                                    size="sm"
                                                    variant="destructive"
                                                >
                                                    Delete
                                                </Button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* Create Modal */}
                {showCreateModal && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                        <div className="bg-white p-6 rounded-lg shadow-lg max-w-md w-full">
                            <h2 className="text-xl font-semibold mb-4">Schedule Maintenance</h2>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-600 mb-1">Asset *</label>
                                    <select
                                        value={formData.configurationItemId}
                                        onChange={(e) => setFormData({ ...formData, configurationItemId: e.target.value })}
                                        className="w-full border rounded-lg p-2"
                                    >
                                        <option value="">Select an asset</option>
                                        {availableItems.map((item) => (
                                            <option key={item.id} value={item.id}>
                                                {item.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-600 mb-1">Title *</label>
                                    <input
                                        type="text"
                                        value={formData.title}
                                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                        className="w-full border rounded-lg p-2"
                                        placeholder="e.g., Quarterly Server Maintenance"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-600 mb-1">Description</label>
                                    <textarea
                                        value={formData.description}
                                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                        className="w-full border rounded-lg p-2"
                                        rows={3}
                                        placeholder="Maintenance details..."
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-600 mb-1">Scheduled Date *</label>
                                    <input
                                        type="datetime-local"
                                        value={formData.scheduledDate}
                                        onChange={(e) => setFormData({ ...formData, scheduledDate: e.target.value })}
                                        className="w-full border rounded-lg p-2"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-600 mb-1">Priority</label>
                                    <select
                                        value={formData.priority}
                                        onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                                        className="w-full border rounded-lg p-2"
                                    >
                                        <option value="LOW">Low</option>
                                        <option value="MEDIUM">Medium</option>
                                        <option value="HIGH">High</option>
                                        <option value="CRITICAL">Critical</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-600 mb-1">Assigned To</label>
                                    <input
                                        type="text"
                                        value={formData.assignedTo}
                                        onChange={(e) => setFormData({ ...formData, assignedTo: e.target.value })}
                                        className="w-full border rounded-lg p-2"
                                        placeholder="User ID or name"
                                    />
                                </div>
                            </div>
                            <div className="flex gap-2 mt-6">
                                <Button onClick={createSchedule}>Create Schedule</Button>
                                <Button onClick={() => setShowCreateModal(false)} variant="outline">
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
