"use client";
import { useState, useEffect } from "react";
import { SkeletonCard, SkeletonActivity } from "@/components/Skeleton";

type AssetStatus = "ACTIVE" | "DEPRECATED" | "MAINTENANCE";

interface DashboardType {
    totalItems: number;
    totalTypes: number;
    untypedItems: number;
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

const statusColors: Record<AssetStatus, string> = {
    ACTIVE: "bg-green-100 text-green-800 border-green-200",
    DEPRECATED: "bg-red-100 text-red-800 border-red-200",
    MAINTENANCE: "bg-yellow-100 text-yellow-800 border-yellow-200",
};

const activityActionColors: Record<string, string> = {
    CREATE: "bg-blue-100 text-blue-800",
    UPDATE: "bg-yellow-100 text-yellow-800",
    DELETE: "bg-red-100 text-red-800",
    LOGIN: "bg-green-100 text-green-800",
    LOGOUT: "bg-gray-100 text-gray-800",
    API_TOKEN_CREATED: "bg-purple-100 text-purple-800",
    API_TOKEN_DELETED: "bg-orange-100 text-orange-800",
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

export default function Dashboard() {
    const [dashboard, setDashboard] = useState<DashboardType | null>(null);
    const [activities, setActivities] = useState<Activity[]>([]);
    const [loading, setLoading] = useState(true);
    const [activityLoading, setActivityLoading] = useState(true);

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

        fetchDashboard();
        fetchActivity();
    }, []);

    if (loading || !dashboard) {
        return (
            <div className="min-h-screen">
                <main className="max-w-7xl mx-auto p-8">
                    <h1 className="text-4xl font-bold text-brand-primary mb-8">Dashboard</h1>
                    <SkeletonCard />
                    <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
                        <div className="lg:col-span-2">
                            <h2 className="text-2xl font-bold text-gray-800 mb-4">Status Overview</h2>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <SkeletonCard />
                                <SkeletonCard />
                                <SkeletonCard />
                            </div>
                        </div>
                        <div className="lg:col-span-1">
                            <div className="bg-white rounded-lg shadow-sm overflow-hidden">
                                <div className="p-4 border-b border-gray-200">
                                    <h2 className="text-xl font-bold text-gray-800">Recent Activity</h2>
                                </div>
                                <SkeletonActivity />
                                <SkeletonActivity />
                                <SkeletonActivity />
                            </div>
                        </div>
                    </div>
                </main>
            </div>
        );
    }

    return (
        <div className="min-h-screen">
            <main className="max-w-7xl mx-auto p-8">
                <h1 className="text-4xl font-bold text-brand-primary mb-8">Dashboard</h1>
                
                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    <div className="bg-white p-6 rounded-lg shadow-sm">
                        <h2 className="text-xl font-semibold text-gray-700">Total Items</h2>
                        <p className="mt-4 text-4xl font-bold text-brand-primary">{dashboard.totalItems}</p>
                    </div>
                    <div className="bg-white p-6 rounded-lg shadow-sm">
                        <h2 className="text-xl font-semibold text-gray-700">Total Types</h2>
                        <p className="mt-4 text-4xl font-bold text-brand-primary">{dashboard.totalTypes}</p>
                    </div>
                    <div className="bg-white p-6 rounded-lg shadow-sm">
                        <h2 className="text-xl font-semibold text-gray-700">Untyped Items</h2>
                        <p className="mt-4 text-4xl font-bold text-brand-primary">{dashboard.untypedItems}</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-8">
                    {/* Status Overview */}
                    <div className="lg:col-span-2">
                        <h2 className="text-2xl font-bold text-gray-800 mb-4">Status Overview</h2>
                        {dashboard.itemsPerStatus.length === 0 ? (
                            <p className="text-gray-600">No status data available.</p>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                {dashboard.itemsPerStatus.map((group) => (
                                    <div key={group.status} className={`p-6 rounded-lg border-2 ${statusColors[group.status]}`}>
                                        <h3 className="text-lg font-semibold capitalize">{group.status.toLowerCase()}</h3>
                                        <p className="mt-2 text-3xl font-bold">{group.count}</p>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Items Per Type */}
                        <div className="mt-8">
                            <h2 className="text-2xl font-bold text-gray-800 mb-4">Items Per Type</h2>
                            {dashboard.itemsPerType.length === 0 ? (
                                <p className="text-gray-600">No items are assigned to a type.</p>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {dashboard.itemsPerType.map((group) => (
                                        <div key={group.itemTypeId} className="bg-white p-6 rounded-lg shadow-sm">
                                            <h3 className="text-xl font-semibold text-gray-700">{group.typeName}</h3>
                                            <p className="mt-2 text-3xl font-bold text-brand-primary">{group.count}</p>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Recent Activity */}
                    <div className="lg:col-span-1">
                        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
                            <div className="p-4 border-b border-gray-200">
                                <h2 className="text-xl font-bold text-gray-800">Recent Activity</h2>
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
                                    <div className="p-4 text-center text-gray-500">
                                        <p>No recent activity.</p>
                                        <p className="text-sm mt-1">Actions will appear here as you use the system.</p>
                                    </div>
                                ) : (
                                    activities.map((activity) => (
                                        <div key={activity.id} className="p-4 hover:bg-gray-50 transition-colors">
                                            <div className="flex items-start gap-3">
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${activityActionColors[activity.action] || "bg-gray-100 text-gray-800"}`}>
                                                            {activity.action}
                                                        </span>
                                                        <span className="text-sm text-gray-500">
                                                            {formatTimeAgo(activity.createdAt)}
                                                        </span>
                                                    </div>
                                                    <p className="mt-1 text-sm text-gray-800">
                                                        {activity.description || `${activity.action} ${activity.entityType}`}
                                                    </p>
                                                    {activity.user && (
                                                        <p className="text-xs text-gray-500 mt-1">
                                                            by {activity.user.name || activity.user.email || "Unknown"}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                            <div className="p-3 border-t border-gray-200 bg-gray-50">
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
