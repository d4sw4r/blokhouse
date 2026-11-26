"use client";
import { useState, useEffect } from "react";
import { SkeletonCard, SkeletonActivity } from "@/components/Skeleton";
import FavoritesWidget from "@/components/FavoritesWidget";
import Link from "next/link";
import { Bell, CheckCircle2, Plus, Tags, BarChart3, Search } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Panel } from "@/components/ui/Panel";
import { StatTile } from "@/components/ui/StatTile";
import { StatusDot } from "@/components/ui/StatusDot";
import { Badge } from "@/components/ui/Badge";
import { statusTone } from "@/lib/ui/status";
import { auditAction } from "@/lib/ui/auditActions";
import { priorityTone } from "@/lib/ui/priority";
import { toneBgClass } from "@/lib/ui/tone";

type AssetStatus = "ACTIVE" | "DEPRECATED" | "MAINTENANCE";
type MaintenancePriority = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

interface DashboardType {
    totalItems: number;
    totalTypes: number;
    untypedItems: number;
    totalTags: number;
    totalRelations: number;
    upcomingMaintenance: number;
    unreadNotifications: number;
    itemsPerType: { itemTypeId: string; count: number; typeName?: string }[];
    itemsPerStatus: { status: AssetStatus; count: number }[];
}

interface Activity {
    id: string;
    action: string;
    entityType: string;
    entityId: string | null;
    description: string | null;
    user: { id: string; name: string | null; email: string | null } | null;
    createdAt: string;
}

interface MaintenanceItem {
    id: string;
    title: string;
    scheduledDate: string;
    status: string;
    priority: MaintenancePriority;
    configurationItem: {
        id: string;
        name: string;
        itemType?: { name: string } | null;
    };
}

function formatTimeAgo(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (seconds < 60) return "just now";
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}d ago`;
    return date.toLocaleDateString();
}

function formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
    });
}

export default function Dashboard() {
    const [dashboard, setDashboard] = useState<DashboardType | null>(null);
    const [activities, setActivities] = useState<Activity[]>([]);
    const [maintenance, setMaintenance] = useState<MaintenanceItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [activityLoading, setActivityLoading] = useState(true);
    const [maintenanceLoading, setMaintenanceLoading] = useState(true);

    useEffect(() => {
        const fetchDashboard = async () => {
            try {
                const res = await fetch("/api/dashboard");
                if (res.ok) {
                    const data = await res.json();
                    setDashboard(data);
                } else {
                    console.error("Failed to fetch dashboard data:", await res.text());
                }
            } catch (error) {
                console.error("Error fetching dashboard data:", error);
            }
            setLoading(false);
        };

        const fetchActivity = async () => {
            try {
                const res = await fetch("/api/activity?limit=10");
                if (res.ok) {
                    const data = await res.json();
                    setActivities(data);
                } else {
                    console.error("Failed to fetch activity:", await res.text());
                }
            } catch (error) {
                console.error("Error fetching activity:", error);
            }
            setActivityLoading(false);
        };

        const fetchMaintenance = async () => {
            try {
                const res = await fetch("/api/maintenance?upcoming=true&limit=5");
                if (res.ok) {
                    const data = await res.json();
                    setMaintenance(data.schedules || []);
                } else {
                    console.error("Failed to fetch maintenance:", await res.text());
                }
            } catch (error) {
                console.error("Error fetching maintenance:", error);
            }
            setMaintenanceLoading(false);
        };

        fetchDashboard();
        fetchActivity();
        fetchMaintenance();
    }, []);

    if (loading || !dashboard) {
        return (
            <div>
                <PageHeader title="Dashboard" />
                <SkeletonCard />
                <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
                    <div className="lg:col-span-2">
                        <SkeletonCard />
                    </div>
                    <div className="lg:col-span-1">
                        <SkeletonActivity />
                    </div>
                </div>
            </div>
        );
    }

    const statusTotal = dashboard.itemsPerStatus.reduce((sum, g) => sum + g.count, 0);
    const quickActions = [
        { href: "/items/new", label: "Add item", icon: Plus },
        { href: "/admin", label: "Manage types", icon: Tags },
        { href: "/reports", label: "Reports", icon: BarChart3 },
        { href: "/discovery", label: "Discovery", icon: Search },
    ];
    const linkClass = "text-sm font-medium text-accent hover:underline";
    const rowClass = "px-4 py-3 hover:bg-surface-2 transition-colors";

    return (
        <div>
            <PageHeader
                title="Dashboard"
                actions={
                    dashboard.unreadNotifications > 0 ? (
                        <Link
                            href="/notifications"
                            className="inline-flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-1.5 text-sm font-medium text-text hover:bg-surface-2"
                        >
                            <Bell className="size-4 text-accent" aria-hidden="true" />
                            {dashboard.unreadNotifications} unread
                        </Link>
                    ) : undefined
                }
            />

            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
                <StatTile label="Total items" value={dashboard.totalItems} />
                <StatTile label="Types" value={dashboard.totalTypes} />
                <StatTile label="Tags" value={dashboard.totalTags} />
                <StatTile label="Relations" value={dashboard.totalRelations} />
                <StatTile label="Untyped" value={dashboard.untypedItems} tone={dashboard.untypedItems > 0 ? "warning" : "neutral"} />
                <StatTile label="Maintenance" value={dashboard.upcomingMaintenance} tone={dashboard.upcomingMaintenance > 0 ? "accent" : "neutral"} />
            </div>

            <div className="mt-6 flex flex-wrap gap-2">
                {quickActions.map(({ href, label, icon: Icon }) => (
                    <Link
                        key={href}
                        href={href}
                        className="inline-flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-1.5 text-sm font-medium text-text hover:bg-surface-2"
                    >
                        <Icon className="size-4 text-muted" aria-hidden="true" />
                        {label}
                    </Link>
                ))}
            </div>

            <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
                <div className="min-w-0 space-y-6 lg:col-span-2">
                    <Panel title="Status overview">
                        {dashboard.itemsPerStatus.length === 0 ? (
                            <p className="text-sm text-muted">No status data available.</p>
                        ) : (
                            <div className="space-y-4">
                                {statusTotal > 0 && (
                                    <div className="flex h-2 overflow-hidden rounded-full bg-surface-2" aria-hidden="true">
                                        {dashboard.itemsPerStatus.map((g) => (
                                            <div
                                                key={g.status}
                                                className={toneBgClass(statusTone(g.status).tone)}
                                                style={{ width: `${(g.count / statusTotal) * 100}%` }}
                                            />
                                        ))}
                                    </div>
                                )}
                                <ul className="divide-y divide-border">
                                    {dashboard.itemsPerStatus.map((g) => (
                                        <li key={g.status} className="flex items-center justify-between py-2">
                                            <StatusDot status={g.status} />
                                            <span className="font-mono text-sm tabular-nums text-text">{g.count}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </Panel>

                    {dashboard.itemsPerType.length > 0 && (
                        <Panel title="Items per type" padded={false}>
                            <ul className="divide-y divide-border">
                                {dashboard.itemsPerType.map((g) => (
                                    <li key={g.itemTypeId} className="flex items-center justify-between gap-3 px-4 py-2">
                                        <span className="min-w-0 truncate text-sm text-text" title={g.typeName}>
                                            {g.typeName}
                                        </span>
                                        <span className="font-mono text-sm tabular-nums text-text">{g.count}</span>
                                    </li>
                                ))}
                            </ul>
                        </Panel>
                    )}
                </div>

                <div className="min-w-0 space-y-6 lg:col-span-1">
                    <FavoritesWidget />

                    <Panel
                        title="Upcoming maintenance"
                        padded={false}
                        actions={
                            <Link href="/maintenance" className={linkClass}>
                                View all
                            </Link>
                        }
                    >
                        <div className="divide-y divide-border">
                            {maintenanceLoading ? (
                                <>
                                    <SkeletonActivity />
                                    <SkeletonActivity />
                                    <SkeletonActivity />
                                </>
                            ) : maintenance.length === 0 ? (
                                <div className="flex flex-col items-center gap-2 p-6 text-center text-sm text-muted">
                                    <CheckCircle2 className="size-6" aria-hidden="true" />
                                    <p>No upcoming maintenance</p>
                                </div>
                            ) : (
                                maintenance.map((item) => (
                                    <div key={item.id} className={rowClass}>
                                        <div className="mb-1 flex items-center justify-between gap-2">
                                            <Badge tone={priorityTone(item.priority).tone}>{priorityTone(item.priority).label}</Badge>
                                            <span className="font-mono text-xs text-muted">{formatDate(item.scheduledDate)}</span>
                                        </div>
                                        <p className="truncate text-sm font-medium text-text" title={item.title}>
                                            {item.title}
                                        </p>
                                        <p className="mt-0.5 truncate font-mono text-xs text-muted" title={item.configurationItem.name}>
                                            {item.configurationItem.name}
                                            {item.configurationItem.itemType && (
                                                <span className="font-sans"> · {item.configurationItem.itemType.name}</span>
                                            )}
                                        </p>
                                    </div>
                                ))
                            )}
                        </div>
                    </Panel>

                    <Panel
                        title="Recent activity"
                        padded={false}
                        actions={
                            <Link href="/admin" className={linkClass}>
                                Audit logs
                            </Link>
                        }
                    >
                        <div className="divide-y divide-border">
                            {activityLoading ? (
                                <>
                                    <SkeletonActivity />
                                    <SkeletonActivity />
                                    <SkeletonActivity />
                                    <SkeletonActivity />
                                    <SkeletonActivity />
                                </>
                            ) : activities.length === 0 ? (
                                <div className="p-6 text-center text-sm text-muted">
                                    <p>No recent activity.</p>
                                    <p className="mt-1">Actions will appear here as you use the system.</p>
                                </div>
                            ) : (
                                activities.map((activity) => (
                                    <div key={activity.id} className={rowClass}>
                                        <div className="flex flex-wrap items-center gap-2">
                                            <Badge tone={auditAction(activity.action).tone}>{auditAction(activity.action).label}</Badge>
                                            <span className="text-xs text-muted">{formatTimeAgo(activity.createdAt)}</span>
                                        </div>
                                        <p className="mt-1 break-words text-sm text-text">
                                            {activity.description || `${activity.action} ${activity.entityType}`}
                                        </p>
                                        {activity.user && (
                                            <p className="mt-0.5 truncate text-xs text-muted">
                                                by {activity.user.name || activity.user.email || "Unknown"}
                                            </p>
                                        )}
                                    </div>
                                ))
                            )}
                        </div>
                    </Panel>
                </div>
            </div>
        </div>
    );
}
