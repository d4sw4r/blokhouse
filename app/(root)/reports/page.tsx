"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { SkeletonCard, SkeletonActivity } from "@/components/Skeleton";
import Link from "next/link";

interface ReportsData {
    creationTrend: Record<string, number>;
    itemsByStatus: { status: string; count: number }[];
    itemsByType: { typeId: string | null; typeName: string; count: number }[];
    tagsDistribution: { id: string; name: string; color: string | null; count: number }[];
    orphanedAssets: {
        id: string;
        name: string;
        status: string;
        missingType: boolean;
        missingTags: boolean;
        createdAt: string;
    }[];
    relationStats: { type: string; count: number }[];
    recentActivity: {
        id: string;
        action: string;
        entityType: string;
        description: string | null;
        createdAt: string;
        user: { name: string | null; email: string | null } | null;
    }[];
    activityByAction: { action: string; count: number }[];
    userStats: {
        id: string;
        name: string | null;
        email: string | null;
        itemCount: number;
        activityCount: number;
    }[];
    totals: {
        items: number;
        types: number;
        tags: number;
        relations: number;
        users: number;
        active: number;
        deprecated: number;
        maintenance: number;
    };
    period: number;
}

const statusColors: Record<string, string> = {
    ACTIVE: "bg-green-500",
    DEPRECATED: "bg-red-500",
    MAINTENANCE: "bg-yellow-500",
};

const actionColors: Record<string, string> = {
    CREATE: "bg-blue-100 text-blue-800",
    UPDATE: "bg-yellow-100 text-yellow-800",
    DELETE: "bg-red-100 text-red-800",
    LOGIN: "bg-green-100 text-green-800",
    LOGOUT: "bg-gray-100 text-gray-800",
};

const relationTypeColors: Record<string, string> = {
    DEPENDS_ON: "bg-red-100 text-red-800",
    RUNS_ON: "bg-blue-100 text-blue-800",
    CONNECTED_TO: "bg-green-100 text-green-800",
    CONTAINS: "bg-purple-100 text-purple-800",
};

export default function ReportsPage() {
    const [data, setData] = useState<ReportsData | null>(null);
    const [loading, setLoading] = useState(true);
    const [period, setPeriod] = useState(30);
    const [activeTab, setActiveTab] = useState<"overview" | "orphaned" | "users">("overview");

    useEffect(() => {
        fetchReports();
    }, [period]);

    const fetchReports = async () => {
        try {
            setLoading(true);
            const res = await fetch(`/api/reports?days=${period}`);
            if (res.ok) {
                const result = await res.json();
                setData(result);
            }
        } catch (error) {
            console.error("Error fetching reports:", error);
        } finally {
            setLoading(false);
        }
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString();
    };

    // Calculate percentages
    const getPercentage = (value: number, total: number) => {
        if (total === 0) return 0;
        return Math.round((value / total) * 100);
    };

    if (loading || !data) {
        return (
            <div className="min-h-screen bg-gray-50">
                <main className="max-w-7xl mx-auto p-8">
                    <h1 className="text-4xl font-bold text-gray-800 mb-8">Reports & Analytics</h1>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                        {[...Array(4)].map((_, i) => (
                            <SkeletonCard key={i} />
                        ))}
                    </div>
                    <SkeletonActivity />
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
                        <h1 className="text-4xl font-bold text-gray-800">Reports & Analytics</h1>
                        <p className="text-gray-600 mt-1">
                            Comprehensive insights into your CMDB data
                        </p>
                    </div>
                    <div className="flex items-center gap-4">
                        <select
                            value={period}
                            onChange={(e) => setPeriod(Number(e.target.value))}
                            className="border rounded-lg px-4 py-2 bg-white"
                        >
                            <option value={7}>Last 7 days</option>
                            <option value={30}>Last 30 days</option>
                            <option value={90}>Last 90 days</option>
                            <option value={365}>Last year</option>
                        </select>
                        <Button onClick={fetchReports} variant="outline">
                            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                            Refresh
                        </Button>
                    </div>
                </div>

                {/* Summary Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-8">
                    <div className="bg-white p-6 rounded-lg shadow-sm">
                        <p className="text-sm font-medium text-gray-600">Total Assets</p>
                        <p className="text-3xl font-bold text-brand-primary">{data.totals.items}</p>
                        <div className="mt-2 flex gap-2 text-xs">
                            <span className="text-green-600">{data.totals.active} active</span>
                            <span className="text-gray-400">|</span>
                            <span className="text-yellow-600">{data.totals.maintenance} maint</span>
                            <span className="text-gray-400">|</span>
                            <span className="text-red-600">{data.totals.deprecated} depr</span>
                        </div>
                    </div>
                    <div className="bg-white p-6 rounded-lg shadow-sm">
                        <p className="text-sm font-medium text-gray-600">Asset Types</p>
                        <p className="text-3xl font-bold text-blue-600">{data.totals.types}</p>
                        <p className="text-xs text-gray-500 mt-2">
                            {data.itemsByType.filter(t => t.typeId === null).reduce((a, b) => a + b.count, 0)} untyped assets
                        </p>
                    </div>
                    <div className="bg-white p-6 rounded-lg shadow-sm">
                        <p className="text-sm font-medium text-gray-600">Tags</p>
                        <p className="text-3xl font-bold text-purple-600">{data.totals.tags}</p>
                        <p className="text-xs text-gray-500 mt-2">
                            {data.tagsDistribution.filter(t => t.count === 0).length} unused tags
                        </p>
                    </div>
                    <div className="bg-white p-6 rounded-lg shadow-sm">
                        <p className="text-sm font-medium text-gray-600">Relations</p>
                        <p className="text-3xl font-bold text-green-600">{data.totals.relations}</p>
                        <p className="text-xs text-gray-500 mt-2">
                            Across {data.itemsByType.length} types
                        </p>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex gap-2 mb-6 border-b">
                    {(["overview", "orphaned", "users"] as const).map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`px-4 py-2 font-medium capitalize transition-colors ${
                                activeTab === tab
                                    ? "text-brand-primary border-b-2 border-brand-primary"
                                    : "text-gray-600 hover:text-gray-800"
                            }`}
                        >
                            {tab === "orphaned" ? "Data Quality" : tab}
                        </button>
                    ))}
                </div>

                {/* Overview Tab */}
                {activeTab === "overview" && (
                    <div className="space-y-6">
                        {/* Status Distribution */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <div className="bg-white p-6 rounded-lg shadow-sm">
                                <h2 className="text-xl font-semibold text-gray-800 mb-4">Asset Status Distribution</h2>
                                <div className="space-y-4">
                                    {data.itemsByStatus.map((status) => {
                                        const percentage = getPercentage(status.count, data.totals.items);
                                        return (
                                            <div key={status.status}>
                                                <div className="flex justify-between text-sm mb-1">
                                                    <span className="font-medium">{status.status}</span>
                                                    <span className="text-gray-600">
                                                        {status.count} ({percentage}%)
                                                    </span>
                                                </div>
                                                <div className="w-full bg-gray-200 rounded-full h-3">
                                                    <div
                                                        className={`h-3 rounded-full ${statusColors[status.status] || "bg-gray-400"}`}
                                                        style={{ width: `${percentage}%` }}
                                                    />
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Tag Distribution */}
                            <div className="bg-white p-6 rounded-lg shadow-sm">
                                <h2 className="text-xl font-semibold text-gray-800 mb-4">Tag Usage</h2>
                                {data.tagsDistribution.length === 0 ? (
                                    <p className="text-gray-500">No tags created yet.</p>
                                ) : (
                                    <div className="space-y-3 max-h-64 overflow-y-auto">
                                        {data.tagsDistribution
                                            .sort((a, b) => b.count - a.count)
                                            .map((tag) => (
                                                <div key={tag.id} className="flex items-center justify-between">
                                                    <div className="flex items-center gap-2">
                                                        <span
                                                            className="w-3 h-3 rounded-full"
                                                            style={{ backgroundColor: tag.color || "#ccc" }}
                                                        />
                                                        <span className="text-sm font-medium">{tag.name}</span>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-24 bg-gray-200 rounded-full h-2">
                                                            <div
                                                                className="bg-purple-500 h-2 rounded-full"
                                                                style={{
                                                                    width: `${getPercentage(tag.count, data.totals.items)}%`,
                                                                }}
                                                            />
                                                        </div>
                                                        <span className="text-xs text-gray-500 w-8 text-right">
                                                            {tag.count}
                                                        </span>
                                                    </div>
                                                </div>
                                            ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Asset Types & Relations */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <div className="bg-white p-6 rounded-lg shadow-sm">
                                <h2 className="text-xl font-semibold text-gray-800 mb-4">Assets by Type</h2>
                                {data.itemsByType.length === 0 ? (
                                    <p className="text-gray-500">No types assigned.</p>
                                ) : (
                                    <div className="space-y-3 max-h-64 overflow-y-auto">
                                        {data.itemsByType
                                            .sort((a, b) => b.count - a.count)
                                            .map((type) => (
                                                <div key={type.typeId || "untyped"} className="flex items-center justify-between">
                                                    <span className="text-sm font-medium">{type.typeName}</span>
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-24 bg-gray-200 rounded-full h-2">
                                                            <div
                                                                className="bg-blue-500 h-2 rounded-full"
                                                                style={{
                                                                    width: `${getPercentage(type.count, data.totals.items)}%`,
                                                                }}
                                                            />
                                                        </div>
                                                        <span className="text-xs text-gray-500 w-8 text-right">
                                                            {type.count}
                                                        </span>
                                                    </div>
                                                </div>
                                            ))}
                                    </div>
                                )}
                            </div>

                            <div className="bg-white p-6 rounded-lg shadow-sm">
                                <h2 className="text-xl font-semibold text-gray-800 mb-4">Relation Types</h2>
                                {data.relationStats.length === 0 ? (
                                    <p className="text-gray-500">No relations created yet.</p>
                                ) : (
                                    <div className="space-y-3">
                                        {data.relationStats.map((rel) => (
                                            <div key={rel.type} className="flex items-center justify-between">
                                                <span
                                                    className={`px-2 py-1 rounded text-xs font-medium ${
                                                        relationTypeColors[rel.type] || "bg-gray-100 text-gray-800"
                                                    }`}
                                                >
                                                    {rel.type.replace(/_/g, " ")}
                                                </span>
                                                <span className="text-sm font-medium">{rel.count}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Recent Activity */}
                        <div className="bg-white p-6 rounded-lg shadow-sm">
                            <h2 className="text-xl font-semibold text-gray-800 mb-4">Recent Activity</h2>
                            {data.recentActivity.length === 0 ? (
                                <p className="text-gray-500">No activity in the selected period.</p>
                            ) : (
                                <div className="space-y-3">
                                    {data.recentActivity.map((activity) => (
                                        <div key={activity.id} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                                            <span
                                                className={`px-2 py-1 rounded text-xs font-medium ${
                                                    actionColors[activity.action] || "bg-gray-100 text-gray-800"
                                                }`}
                                            >
                                                {activity.action}
                                            </span>
                                            <div className="flex-1">
                                                <p className="text-sm text-gray-800">
                                                    {activity.description || `${activity.action} ${activity.entityType}`}
                                                </p>
                                                <p className="text-xs text-gray-500 mt-1">
                                                    by {activity.user?.name || activity.user?.email || "System"} • {formatDate(activity.createdAt)}
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Orphaned Assets Tab */}
                {activeTab === "orphaned" && (
                    <div className="space-y-6">
                        <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg">
                            <h3 className="font-semibold text-yellow-800 flex items-center gap-2">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                                Data Quality Issues
                            </h3>
                            <p className="text-sm text-yellow-700 mt-1">
                                Found {data.orphanedAssets.length} assets with incomplete data. 
                                These assets are missing type assignments or tags.
                            </p>
                        </div>

                        {data.orphanedAssets.length === 0 ? (
                            <div className="bg-green-50 border border-green-200 p-8 rounded-lg text-center">
                                <svg className="w-12 h-12 mx-auto text-green-500 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <h3 className="font-semibold text-green-800">All Clear!</h3>
                                <p className="text-sm text-green-700 mt-1">All assets have proper type and tag assignments.</p>
                            </div>
                        ) : (
                            <div className="bg-white rounded-lg shadow-sm overflow-hidden">
                                <table className="min-w-full">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="py-3 px-4 text-left text-sm font-medium text-gray-600">Asset Name</th>
                                            <th className="py-3 px-4 text-left text-sm font-medium text-gray-600">Status</th>
                                            <th className="py-3 px-4 text-left text-sm font-medium text-gray-600">Missing</th>
                                            <th className="py-3 px-4 text-left text-sm font-medium text-gray-600">Created</th>
                                            <th className="py-3 px-4 text-left text-sm font-medium text-gray-600">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-200">
                                        {data.orphanedAssets.map((asset) => (
                                            <tr key={asset.id} className="hover:bg-gray-50">
                                                <td className="py-3 px-4 font-medium text-gray-800">{asset.name}</td>
                                                <td className="py-3 px-4">
                                                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                                        statusColors[asset.status] || "bg-gray-400"
                                                    } text-white`}>
                                                        {asset.status}
                                                    </span>
                                                </td>
                                                <td className="py-3 px-4">
                                                    <div className="flex gap-2">
                                                        {asset.missingType && (
                                                            <span className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs">
                                                                Type
                                                            </span>
                                                        )}
                                                        {asset.missingTags && (
                                                            <span className="px-2 py-1 bg-orange-100 text-orange-700 rounded text-xs">
                                                                Tags
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="py-3 px-4 text-sm text-gray-500">
                                                    {formatDate(asset.createdAt)}
                                                </td>
                                                <td className="py-3 px-4">
                                                    <Link href={`/items/${asset.id}`}>
                                                        <Button size="sm" variant="outline">Edit</Button>
                                                    </Link>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}

                {/* Users Tab */}
                {activeTab === "users" && (
                    <div className="space-y-6">
                        <div className="bg-white p-6 rounded-lg shadow-sm">
                            <h2 className="text-xl font-semibold text-gray-800 mb-4">
                                Top Contributors ({data.totals.users} total users)
                            </h2>
                            {data.userStats.length === 0 ? (
                                <p className="text-gray-500">No user activity recorded.</p>
                            ) : (
                                <div className="space-y-4">
                                    {data.userStats.map((user, index) => (
                                        <div key={user.id} className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
                                            <div className="w-8 h-8 bg-brand-primary text-white rounded-full flex items-center justify-center font-bold">
                                                {index + 1}
                                            </div>
                                            <div className="flex-1">
                                                <p className="font-medium text-gray-800">
                                                    {user.name || user.email || "Unknown"}
                                                </p>
                                                <p className="text-sm text-gray-500">{user.email}</p>
                                            </div>
                                            <div className="flex gap-6 text-sm">
                                                <div className="text-center">
                                                    <p className="font-bold text-brand-primary">{user.itemCount}</p>
                                                    <p className="text-gray-500 text-xs">Assets</p>
                                                </div>
                                                <div className="text-center">
                                                    <p className="font-bold text-blue-600">{user.activityCount}</p>
                                                    <p className="text-gray-500 text-xs">Activities</p>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Activity Summary */}
                        <div className="bg-white p-6 rounded-lg shadow-sm">
                            <h2 className="text-xl font-semibold text-gray-800 mb-4">Activity Summary (Last {period} Days)</h2>
                            {data.activityByAction.length === 0 ? (
                                <p className="text-gray-500">No activity recorded in this period.</p>
                            ) : (
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    {data.activityByAction.map((activity) => (
                                        <div key={activity.action} className="p-4 bg-gray-50 rounded-lg text-center">
                                            <p className="text-2xl font-bold text-brand-primary">{activity.count}</p>
                                            <span
                                                className={`inline-block mt-1 px-2 py-1 rounded text-xs font-medium ${
                                                    actionColors[activity.action] || "bg-gray-100 text-gray-800"
                                                }`}
                                            >
                                                {activity.action}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}
