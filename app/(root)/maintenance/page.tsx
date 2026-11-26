"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { CalendarCheck, Plus } from "lucide-react";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Dialog, DialogContent } from "@/components/ui/Dialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { PageHeader } from "@/components/ui/PageHeader";
import { Select } from "@/components/ui/Select";
import { StatTile } from "@/components/ui/StatTile";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/Table";
import { Textarea } from "@/components/ui/Textarea";
import { SkeletonCard, SkeletonTable } from "@/components/Skeleton";

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

const statusTones: Record<string, BadgeTone> = {
    SCHEDULED: "accent",
    IN_PROGRESS: "warning",
    COMPLETED: "success",
    CANCELLED: "neutral",
};

const priorityTones: Record<string, BadgeTone> = {
    LOW: "neutral",
    MEDIUM: "accent",
    HIGH: "warning",
    CRITICAL: "danger",
};

const statusFilterOptions = [
    { value: "ALL", label: "All" },
    { value: "SCHEDULED", label: "Scheduled" },
    { value: "IN_PROGRESS", label: "In Progress" },
    { value: "COMPLETED", label: "Completed" },
    { value: "CANCELLED", label: "Cancelled" },
];

const priorityOptions = [
    { value: "LOW", label: "Low" },
    { value: "MEDIUM", label: "Medium" },
    { value: "HIGH", label: "High" },
    { value: "CRITICAL", label: "Critical" },
];

export default function MaintenancePage() {
    const [schedules, setSchedules] = useState<MaintenanceSchedule[]>([]);
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState<string>("ALL");
    const [showCreateModal, setShowCreateModal] = useState(false);


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
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [statusFilter]); // fetchSchedules and fetchItems are stable function declarations

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
            <div>
                <PageHeader title="Maintenance Schedule" />
                <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
                    {[...Array(4)].map((_, i) => (
                        <SkeletonCard key={i} />
                    ))}
                </div>
                <SkeletonTable rows={5} />
            </div>
        );
    }

    return (
        <div>
            <PageHeader
                title="Maintenance Schedule"
                description="Manage and track maintenance tasks for your assets"
                actions={
                    <Button onClick={() => setShowCreateModal(true)}>
                        <Plus className="size-4" aria-hidden="true" />
                        Schedule Maintenance
                    </Button>
                }
            />

            {/* Stats */}
            <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-5">
                <StatTile label="Total Tasks" value={stats.total} />
                <StatTile label="Scheduled" value={stats.scheduled} />
                <StatTile label="In Progress" value={stats.inProgress} />
                <StatTile label="Completed" value={stats.completed} />
                <StatTile label="Overdue" value={stats.overdue} tone={stats.overdue > 0 ? "danger" : "neutral"} />
            </div>

            {/* Filter */}
            <div className="mb-4 flex flex-wrap items-center gap-2">
                <label htmlFor="maintenance-status-filter" className="text-sm font-medium text-text">
                    Filter by Status:
                </label>
                <Select
                    id="maintenance-status-filter"
                    value={statusFilter}
                    onValueChange={setStatusFilter}
                    options={statusFilterOptions}
                    className="w-44"
                />
            </div>

            {/* Schedules Table */}
            {schedules.length === 0 ? (
                <EmptyState
                    icon={CalendarCheck}
                    title="No Maintenance Tasks"
                    description="Create your first maintenance schedule to get started"
                />
            ) : (
                <Table>
                    <THead>
                        <tr>
                            <TH>Task</TH>
                            <TH>Asset</TH>
                            <TH>Scheduled Date</TH>
                            <TH>Priority</TH>
                            <TH>Status</TH>
                            <TH>Actions</TH>
                        </tr>
                    </THead>
                    <TBody>
                        {schedules.map((schedule) => {
                            const overdue = isOverdue(schedule.scheduledDate) && schedule.status === "SCHEDULED";
                            return (
                                <TR key={schedule.id}>
                                    <TD className="min-w-48 max-w-sm">
                                        <p className="font-medium break-words">{schedule.title}</p>
                                        {schedule.description && (
                                            <p className="text-xs break-words text-muted">{schedule.description}</p>
                                        )}
                                    </TD>
                                    <TD mono className="max-w-48">
                                        <Link
                                            href={`/items/${schedule.configurationItem.id}`}
                                            className="block truncate text-accent hover:underline"
                                            title={schedule.configurationItem.name}
                                        >
                                            {schedule.configurationItem.name}
                                        </Link>
                                    </TD>
                                    <TD mono className="whitespace-nowrap">
                                        <span className={overdue ? "font-medium" : ""}>
                                            {formatDate(schedule.scheduledDate)}
                                        </span>
                                        {overdue && (
                                            <Badge tone="danger" className="ml-2 font-sans">Overdue</Badge>
                                        )}
                                    </TD>
                                    <TD>
                                        <Badge tone={priorityTones[schedule.priority] ?? "neutral"}>
                                            {schedule.priority}
                                        </Badge>
                                    </TD>
                                    <TD>
                                        <Badge tone={statusTones[schedule.status] ?? "neutral"}>
                                            {schedule.status.replace("_", " ")}
                                        </Badge>
                                    </TD>
                                    <TD>
                                        <div className="flex flex-wrap gap-2">
                                            {schedule.status === "SCHEDULED" && (
                                                <Button
                                                    onClick={() => updateStatus(schedule.id, "IN_PROGRESS")}
                                                    size="sm"
                                                    variant="secondary"
                                                >
                                                    Start
                                                </Button>
                                            )}
                                            {schedule.status === "IN_PROGRESS" && (
                                                <Button
                                                    onClick={() => updateStatus(schedule.id, "COMPLETED")}
                                                    size="sm"
                                                >
                                                    Complete
                                                </Button>
                                            )}
                                            {schedule.status !== "COMPLETED" && schedule.status !== "CANCELLED" && (
                                                <Button
                                                    onClick={() => updateStatus(schedule.id, "CANCELLED")}
                                                    size="sm"
                                                    variant="secondary"
                                                >
                                                    Cancel
                                                </Button>
                                            )}
                                            <Button
                                                onClick={() => deleteSchedule(schedule.id)}
                                                size="sm"
                                                variant="danger"
                                            >
                                                Delete
                                            </Button>
                                        </div>
                                    </TD>
                                </TR>
                            );
                        })}
                    </TBody>
                </Table>
            )}

            {/* Create Modal */}
            <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
                <DialogContent
                    title="Schedule Maintenance"
                    footer={
                        <>
                            <Button onClick={() => setShowCreateModal(false)} variant="secondary">
                                Cancel
                            </Button>
                            <Button onClick={createSchedule}>Create Schedule</Button>
                        </>
                    }
                >
                    <div className="space-y-4">
                        <Field label="Asset *" htmlFor="maint-asset">
                            <Select
                                id="maint-asset"
                                value={formData.configurationItemId}
                                onValueChange={(v) => setFormData({ ...formData, configurationItemId: v })}
                                options={availableItems.map((item) => ({ value: item.id, label: item.name }))}
                                placeholder="Select an asset"
                            />
                        </Field>
                        <Field label="Title *" htmlFor="maint-title">
                            <Input
                                id="maint-title"
                                type="text"
                                value={formData.title}
                                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                placeholder="e.g., Quarterly Server Maintenance"
                            />
                        </Field>
                        <Field label="Description" htmlFor="maint-description">
                            <Textarea
                                id="maint-description"
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                rows={3}
                                placeholder="Maintenance details..."
                            />
                        </Field>
                        <Field label="Scheduled Date *" htmlFor="maint-date">
                            <Input
                                id="maint-date"
                                type="datetime-local"
                                value={formData.scheduledDate}
                                onChange={(e) => setFormData({ ...formData, scheduledDate: e.target.value })}
                            />
                        </Field>
                        <Field label="Priority" htmlFor="maint-priority">
                            <Select
                                id="maint-priority"
                                value={formData.priority}
                                onValueChange={(v) => setFormData({ ...formData, priority: v })}
                                options={priorityOptions}
                            />
                        </Field>
                        <Field label="Assigned To" htmlFor="maint-assigned">
                            <Input
                                id="maint-assigned"
                                type="text"
                                value={formData.assignedTo}
                                onChange={(e) => setFormData({ ...formData, assignedTo: e.target.value })}
                                placeholder="User ID or name"
                            />
                        </Field>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
