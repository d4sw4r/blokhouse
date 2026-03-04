"use client";
import { useState, useEffect } from "react";
import { SkeletonCard, SkeletonActivity } from "@/components/Skeleton";
import FavoritesWidget from "@/components/FavoritesWidget";

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

const statusColors: Record<AssetStatus, string> = {
    ACTIVE: "bg-green-100 text-green-800 border-green-200",
    DEPRECATED: "bg-red-100 text-red-800 border-red-200",
    MAINTENANCE: "bg-yellow-100 text-yellow-800 border-yellow-200",
};

const priorityColors: Record<MaintenancePriority, string> = {
    LOW: "bg-brand-secondary/20 text-brand-secondary",
    MEDIUM: "bg-brand-primary/20 text-brand-primary",
    HIGH: "bg-brand-accent/20 text-brand-accent",
    CRITICAL: "bg-brand-accent/30 text-brand-accent",
};

const activityActionColors: Record<string, string> = {
    CREATE: "bg-brand-primary/20 text-brand-primary",
    UPDATE: "bg-brand-secondary/20 text-brand-secondary",
    DELETE: "bg-brand-accent/20 text-brand-accent",
    LOGIN: "bg-brand-primary/20 text-brand-primary",
    LOGOUT: "bg-brand-secondary/20 text-brand-secondary",
    API_TOKEN_CREATED: "bg-brand-primary/20 text-brand-primary",
    API_TOKEN_DELETED: "bg-brand-accent/20 text-brand-accent",
};

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

// Quick Action Card Component
function QuickActionCard({
    href,
    icon,
    title,
    description,
    color,
}: {
    href: string;
    icon: string;
    title: string;
    description: string;
    color: string;
}) {
    return (
        <a
            href={href}
            className="group bg-white p-5 rounded-lg shadow-sm hover:shadow-md transition-all border border-brand-secondary/20 hover:border-brand-primary/30"
        >
            <div className="flex items-start gap-4">
                <div
                    className={`w-12 h-12 rounded-lg ${color} flex items-center justify-center text-2xl group-hover:scale-110 transition-transform`}
                >
                    {icon}
                </div>
                <div className="flex-1">
                    <h3 className="font-semibold text-brand-text group-hover:text-brand-primary transition-colors">
                        {title}
                    </h3>
                    <p className="text-sm text-brand-secondary mt-1">{description}</p>
                </div>
            </div>
        </a>
    );
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
            <div className="min-h-screen">
                <main className="max-w-7xl mx-auto p-8">
                    <h1 className="text-4xl font-bold text-brand-primary mb-8">Dashboard</h1>
                    <SkeletonCard />
                    <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
                        <div className="lg:col-span-2">
                            <SkeletonCard />
                        </div>
                        <div className="lg:col-span-1">
                            <SkeletonActivity />
                        </div>
                    </div>
                </main>
            </div>
        );
    }

    return (
        <div className="min-h-screen">
            <main className="max-w-7xl mx-auto p-8">
                <div className="flex items-center justify-between mb-8">
                    <h1 className="text-4xl font-bold text-brand-primary">Dashboard</h1>
                    {dashboard.unreadNotifications > 0 && (
                        <a
                            href="/notifications"
                            className="flex items-center gap-2 px-4 py-2 bg-brand-accent/20 text-brand-accent rounded-lg hover:bg-brand-accent/30 transition-colors"
                        >
                            <span>🔔</span>
                            <span className="font-medium">{dashboard.unreadNotifications} unread</span>
                        </a>
                    )}
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                    <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-100">
                        <p className="text-sm text-brand-secondary font-medium">Total Items</p>
                        <p className="mt-2 text-3xl font-bold text-brand-primary">{dashboard.totalItems}</p>
                    </div>
                    <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-100">
                        <p className="text-sm text-brand-secondary font-medium">Types</p>
                        <p className="mt-2 text-3xl font-bold text-brand-primary">{dashboard.totalTypes}</p>
                    </div>
                    <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-100">
                        <p className="text-sm text-brand-secondary font-medium">Tags</p>
                        <p className="mt-2 text-3xl font-bold text-brand-secondary">{dashboard.totalTags}</p>
                    </div>
                    <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-100">
                        <p className="text-sm text-brand-secondary font-medium">Relations</p>
                        <p className="mt-2 text-3xl font-bold text-brand-accent">{dashboard.totalRelations}</p>
                    </div>
                    <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-100">
                        <p className="text-sm text-brand-secondary font-medium">Untyped</p>
                        <p className="mt-2 text-3xl font-bold text-brand-primary/80">{dashboard.untypedItems}</p>
                    </div>
                    <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-100">
                        <p className="text-sm text-brand-secondary font-medium">Maintenance</p>
                        <p className="mt-2 text-3xl font-bold text-brand-secondary">{dashboard.upcomingMaintenance}</p>
                    </div>
                </div>

                {/* Quick Actions */}
                <div className="mt-8">
                    <h2 className="text-xl font-bold text-brand-text mb-4">Quick Actions</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <QuickActionCard
                            href="/items/new"
                            icon="➕"
                            title="Add Item"
                            description="Create a new configuration item"
                            color="bg-brand-primary/20"
                        />
                        <QuickActionCard
                            href="/admin"
                            icon="🏷️"
                            title="Manage Types"
                            description="Create or edit item types"
                            color="bg-brand-secondary/20"
                        />
                        <QuickActionCard
                            href="/reports"
                            icon="📊"
                            title="View Reports"
                            description="Detailed analytics and insights"
                            color="bg-brand-primary/20"
                        />
                        <QuickActionCard
                            href="/discovery"
                            icon="🔍"
                            title="Discovery"
                            description="Network discovery scan"
                            color="bg-brand-accent/20"
                        />
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-8">
                    {/* Left Column */}
                    <div className="lg:col-span-2 space-y-8">
                        {/* Status Overview */}
                        <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
                            <h2 className="text-xl font-bold text-brand-text mb-4">Status Overview</h2>
                            {dashboard.itemsPerStatus.length === 0 ? (
                                <p className="text-brand-secondary">No status data available.</p>
                            ) : (
                                <div className="grid grid-cols-3 gap-4">
                                    {dashboard.itemsPerStatus.map((group) => (
                                        <div
                                            key={group.status}
                                            className={`p-4 rounded-lg border-2 ${statusColors[group.status]} text-center`}
                                        >
                                            <p className="text-2xl font-bold">{group.count}</p>
                                            <p className="text-sm font-medium capitalize mt-1">
                                                {group.status.toLowerCase()}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Items Per Type */}
                        {dashboard.itemsPerType.length > 0 && (
                            <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
                                <h2 className="text-xl font-bold text-brand-text mb-4">Items Per Type</h2>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                    {dashboard.itemsPerType.map((group) => (
                                        <div
                                            key={group.itemTypeId}
                                            className="p-4 bg-brand-primary/5 rounded-lg text-center hover:bg-brand-primary/10 transition-colors"
                                        >
                                            <p className="text-2xl font-bold text-brand-primary">{group.count}</p>
                                            <p className="text-sm text-brand-secondary mt-1 truncate">{group.typeName}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Right Column */}
                    <div className="lg:col-span-1 space-y-8">
                        {/* Favorites Widget */}
                        <FavoritesWidget />

                        {/* Upcoming Maintenance */}
                        <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
                            <div className="p-4 border-b border-gray-200">
                                <h2 className="text-lg font-bold text-brand-text">Upcoming Maintenance</h2>
                            </div>
                            <div className="divide-y divide-gray-100">
                                {maintenanceLoading ? (
                                    <>
                                        <SkeletonActivity />
                                        <SkeletonActivity />
                                        <SkeletonActivity />
                                    </>
                                ) : maintenance.length === 0 ? (
                                    <div className="p-4 text-center text-gray-500">
                                        <p className="text-2xl mb-2">✅</p>
                                        <p>No upcoming maintenance</p>
                                    </div>
                                ) : (
                                    maintenance.map((item) => (
                                        <div key={item.id} className="p-4 hover:bg-brand-primary/5 transition-colors">
                                            <div className="flex items-center justify-between mb-2">
                                                <span
                                                    className={`px-2 py-0.5 rounded-full text-xs font-medium ${priorityColors[item.priority]}`}
                                                >
                                                    {item.priority}
                                                </span>
                                                <span className="text-sm text-brand-secondary">{formatDate(item.scheduledDate)}</span>
                                            </div>
                                            <p className="font-medium text-brand-text text-sm truncate">{item.title}</p>
                                            <p className="text-xs text-brand-secondary mt-1 truncate">
                                                {item.configurationItem.name}
                                                {item.configurationItem.itemType && (
                                                    <span className="text-brand-secondary/60">
                                                        {" "}
                                                        · {item.configurationItem.itemType.name}
                                                    </span>
                                                )}
                                            </p>
                                        </div>
                                    ))
                                )}
                            </div>
                            <div className="p-3 border-t border-brand-secondary/20 bg-brand-primary/5">
                                <a
                                    href="/maintenance"
                                    className="text-sm text-brand-primary hover:text-brand-accent font-medium"
                                >
                                    View all maintenance →
                                </a>
                            </div>
                        </div>

                        {/* Recent Activity */}
                        <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
                            <div className="p-4 border-b border-gray-200">
                                <h2 className="text-lg font-bold text-brand-text">Recent Activity</h2>
                            </div>
                            <div className="divide-y divide-gray-100">
                                {activityLoading ? (
                                    <>
                                        <SkeletonActivity />
                                        <SkeletonActivity />
                                        <SkeletonActivity />
                                        <SkeletonActivity />
                                        <SkeletonActivity />
                                    </>
                                ) : activities.length === 0 ? (
                                    <div className="p-4 text-center text-brand-secondary">
                                        <p>No recent activity.</p>
                                        <p className="text-sm mt-1">Actions will appear here as you use the system.</p>
                                    </div>
                                ) : (
                                    activities.map((activity) => (
                                        <div key={activity.id} className="p-4 hover:bg-brand-primary/5 transition-colors">
                                            <div className="flex items-start gap-3">
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <span
                                                            className={`px-2 py-0.5 rounded-full text-xs font-medium ${activityActionColors[activity.action] || "bg-brand-secondary/20 text-brand-secondary"}`}
                                                        >
                                                            {activity.action}
                                                        </span>
                                                        <span className="text-sm text-brand-secondary">
                                                            {formatTimeAgo(activity.createdAt)}
                                                        </span>
                                                    </div>
                                                    <p className="mt-1 text-sm text-brand-text">
                                                        {activity.description || `${activity.action} ${activity.entityType}`}
                                                    </p>
                                                    {activity.user && (
                                                        <p className="text-xs text-brand-secondary mt-1">
                                                            by {activity.user.name || activity.user.email || "Unknown"}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                            <div className="p-3 border-t border-brand-secondary/20 bg-brand-primary/5">
                                <a
                                    href="/admin"
                                    className="text-sm text-brand-primary hover:text-brand-accent font-medium"
                                >
                                    View full audit logs →
                                </a>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
