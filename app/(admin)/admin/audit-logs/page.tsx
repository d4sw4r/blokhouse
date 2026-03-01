"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { SkeletonTable, LoadingSpinner } from "@/components/Skeleton";

interface AuditLog {
    id: string;
    action: string;
    entityType: string;
    entityId: string | null;
    description: string | null;
    oldValues: string | null;
    newValues: string | null;
    ipAddress: string | null;
    userAgent: string | null;
    createdAt: string;
    user: {
        id: string;
        name: string | null;
        email: string | null;
    } | null;
}

interface PaginationData {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}

const actionColors: Record<string, string> = {
    CREATE: "bg-green-100 text-green-800 border-green-200",
    UPDATE: "bg-yellow-100 text-yellow-800 border-yellow-200",
    DELETE: "bg-red-100 text-red-800 border-red-200",
    LOGIN: "bg-blue-100 text-blue-800 border-blue-200",
    LOGOUT: "bg-gray-100 text-gray-800 border-gray-200",
    API_TOKEN_CREATED: "bg-purple-100 text-purple-800 border-purple-200",
    API_TOKEN_DELETED: "bg-orange-100 text-orange-800 border-orange-200",
};

const actionLabels: Record<string, string> = {
    CREATE: "Created",
    UPDATE: "Updated",
    DELETE: "Deleted",
    LOGIN: "Login",
    LOGOUT: "Logout",
    API_TOKEN_CREATED: "API Token Created",
    API_TOKEN_DELETED: "API Token Deleted",
};

const entityTypeLabels: Record<string, string> = {
    ConfigurationItem: "Asset",
    User: "User",
    ApiToken: "API Token",
    Tag: "Tag",
    ItemType: "Type",
    CustomField: "Custom Field",
    AssetRelation: "Relation",
};

export default function AuditLogsPage() {
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [pagination, setPagination] = useState<PaginationData>({
        total: 0,
        page: 1,
        limit: 50,
        totalPages: 1,
    });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Filter states
    const [actionFilter, setActionFilter] = useState<string>("");
    const [entityTypeFilter, setEntityTypeFilter] = useState<string>("");
    const [searchQuery, setSearchQuery] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");

    // Detail modal state
    const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

    // Available filter options
    const actionTypes = ["CREATE", "UPDATE", "DELETE", "LOGIN", "LOGOUT", "API_TOKEN_CREATED", "API_TOKEN_DELETED"];
    const entityTypes = ["ConfigurationItem", "User", "ApiToken", "Tag", "ItemType", "CustomField", "AssetRelation"];

    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(searchQuery);
            setPagination(prev => ({ ...prev, page: 1 }));
        }, 300);
        return () => clearTimeout(timer);
    }, [searchQuery]);

    useEffect(() => {
        fetchLogs();
    }, [pagination.page, pagination.limit, actionFilter, entityTypeFilter, debouncedSearch]);

    const fetchLogs = async () => {
        try {
            setLoading(true);
            setError(null);

            const params = new URLSearchParams({
                page: pagination.page.toString(),
                limit: pagination.limit.toString(),
            });

            if (actionFilter) params.append("action", actionFilter);
            if (entityTypeFilter) params.append("entityType", entityTypeFilter);

            const res = await fetch(`/api/audit-logs?${params.toString()}`);

            if (!res.ok) {
                if (res.status === 403) {
                    setError("You don't have permission to view audit logs. Admin or Audit role required.");
                } else {
                    setError("Failed to fetch audit logs");
                }
                return;
            }

            const data = await res.json();
            setLogs(data.logs || []);
            setPagination(data.pagination || { total: 0, page: 1, limit: 50, totalPages: 1 });
        } catch (err) {
            setError("Network error occurred");
            console.error("Error fetching audit logs:", err);
        } finally {
            setLoading(false);
        }
    };

    const exportLogs = async (format: "json" | "csv") => {
        try {
            const params = new URLSearchParams({
                page: "1",
                limit: "1000", // Export more logs
            });

            if (actionFilter) params.append("action", actionFilter);
            if (entityTypeFilter) params.append("entityType", entityTypeFilter);

            const res = await fetch(`/api/audit-logs?${params.toString()}`);
            if (!res.ok) {
                alert("Failed to export logs");
                return;
            }

            const data = await res.json();
            const logsToExport = data.logs || [];

            if (format === "json") {
                const blob = new Blob([JSON.stringify(logsToExport, null, 2)], { type: "application/json" });
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `audit-logs-${new Date().toISOString().split("T")[0]}.json`;
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
                document.body.removeChild(a);
            } else {
                // CSV export
                const headers = ["Timestamp", "Action", "Entity Type", "Entity ID", "Description", "User", "IP Address"];
                const csvRows = logsToExport.map((log: AuditLog) => [
                    new Date(log.createdAt).toISOString(),
                    log.action,
                    log.entityType,
                    log.entityId || "",
                    log.description || "",
                    log.user?.name || log.user?.email || "System",
                    log.ipAddress || "",
                ]);
                const csvContent = [headers.join(","), ...csvRows.map((row: string[]) => row.map(cell => `"${cell}"`).join(","))].join("\n");
                const blob = new Blob([csvContent], { type: "text/csv" });
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `audit-logs-${new Date().toISOString().split("T")[0]}.csv`;
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
                document.body.removeChild(a);
            }
        } catch (error) {
            console.error("Export error:", error);
            alert("Export failed");
        }
    };

    const clearFilters = () => {
        setActionFilter("");
        setEntityTypeFilter("");
        setSearchQuery("");
        setDebouncedSearch("");
        setPagination(prev => ({ ...prev, page: 1 }));
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleString("en-US", {
            year: "numeric",
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
        });
    };

    const formatTimeAgo = (dateString: string) => {
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
        return formatDate(dateString);
    };

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

    if (error) {
        return (
            <div className="max-w-6xl mx-auto">
                <h1 className="text-4xl font-bold text-gray-800 mb-6">Audit Logs</h1>
                <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
                    <svg className="w-12 h-12 mx-auto mb-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    <h2 className="text-lg font-semibold text-red-800 mb-2">Access Denied</h2>
                    <p className="text-red-600">{error}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-6xl mx-auto">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                <div>
                    <h1 className="text-4xl font-bold text-gray-800">Audit Logs</h1>
                    <p className="text-gray-600 mt-1">Track all changes and activities in the system</p>
                </div>
                <div className="flex gap-2">
                    <Button onClick={() => exportLogs("csv")} variant="outline">
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        Export CSV
                    </Button>
                    <Button onClick={() => exportLogs("json")} variant="outline">
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        Export JSON
                    </Button>
                </div>
            </div>

            {/* Statistics */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-white rounded-lg shadow-sm p-4">
                    <p className="text-sm font-medium text-gray-600">Total Logs</p>
                    <p className="text-2xl font-bold text-brand-primary">{pagination.total.toLocaleString()}</p>
                </div>
                <div className="bg-white rounded-lg shadow-sm p-4">
                    <p className="text-sm font-medium text-gray-600">Current Page</p>
                    <p className="text-2xl font-bold text-blue-600">{pagination.page} <span className="text-sm text-gray-400">/ {pagination.totalPages}</span></p>
                </div>
                <div className="bg-white rounded-lg shadow-sm p-4">
                    <p className="text-sm font-medium text-gray-600">Showing</p>
                    <p className="text-2xl font-bold text-green-600">{logs.length} <span className="text-sm text-gray-400">logs</span></p>
                </div>
                <div className="bg-white rounded-lg shadow-sm p-4">
                    <p className="text-sm font-medium text-gray-600">Per Page</p>
                    <select
                        value={pagination.limit}
                        onChange={(e) => setPagination(prev => ({ ...prev, limit: parseInt(e.target.value), page: 1 }))}
                        className="mt-1 block w-full border rounded-md p-1 text-sm"
                    >
                        <option value="25">25</option>
                        <option value="50">50</option>
                        <option value="100">100</option>
                    </select>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
                        <div className="relative">
                            <svg className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                            <input
                                type="text"
                                placeholder="Search description, user..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-transparent"
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Action Type</label>
                        <select
                            value={actionFilter}
                            onChange={(e) => setActionFilter(e.target.value)}
                            className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-brand-primary"
                        >
                            <option value="">All Actions</option>
                            {actionTypes.map(action => (
                                <option key={action} value={action}>{actionLabels[action] || action}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Entity Type</label>
                        <select
                            value={entityTypeFilter}
                            onChange={(e) => setEntityTypeFilter(e.target.value)}
                            className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-brand-primary"
                        >
                            <option value="">All Entities</option>
                            {entityTypes.map(type => (
                                <option key={type} value={type}>{entityTypeLabels[type] || type}</option>
                            ))}
                        </select>
                    </div>
                    <div className="flex items-end">
                        <Button onClick={clearFilters} variant="outline" className="w-full">
                            Clear Filters
                        </Button>
                    </div>
                </div>
            </div>

            {/* Logs Table */}
            <div className="bg-white rounded-lg shadow-sm overflow-hidden">
                {loading ? (
                    <div className="p-8">
                        <SkeletonTable rows={10} />
                    </div>
                ) : logs.length === 0 ? (
                    <div className="p-12 text-center">
                        <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                        </svg>
                        <h3 className="text-lg font-medium text-gray-900 mb-2">No logs found</h3>
                        <p className="text-gray-500">
                            {actionFilter || entityTypeFilter || searchQuery
                                ? "Try adjusting your filters"
                                : "No audit logs available yet"}
                        </p>
                    </div>
                ) : (
                    <>
                        <div className="overflow-x-auto">
                            <table className="min-w-full">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Time</th>
                                        <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                                        <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Entity</th>
                                        <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                                        <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                                        <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200">
                                    {logs.map((log) => (
                                        <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                                            <td className="py-3 px-4 whitespace-nowrap">
                                                <div className="text-sm text-gray-900" title={formatDate(log.createdAt)}>
                                                    {formatTimeAgo(log.createdAt)}
                                                </div>
                                                <div className="text-xs text-gray-500">
                                                    {new Date(log.createdAt).toLocaleDateString()}
                                                </div>
                                            </td>
                                            <td className="py-3 px-4 whitespace-nowrap">
                                                <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full border ${actionColors[log.action] || "bg-gray-100 text-gray-800"}`}>
                                                    {actionLabels[log.action] || log.action}
                                                </span>
                                            </td>
                                            <td className="py-3 px-4 whitespace-nowrap">
                                                <div className="text-sm text-gray-900">
                                                    {entityTypeLabels[log.entityType] || log.entityType}
                                                </div>
                                                {log.entityId && (
                                                    <code className="text-xs text-gray-500 bg-gray-100 px-1 rounded">
                                                        {log.entityId.slice(0, 8)}...
                                                    </code>
                                                )}
                                            </td>
                                            <td className="py-3 px-4">
                                                <div className="text-sm text-gray-900 max-w-md truncate">
                                                    {log.description || `${log.action} ${log.entityType}`}
                                                </div>
                                            </td>
                                            <td className="py-3 px-4 whitespace-nowrap">
                                                {log.user ? (
                                                    <div className="text-sm text-gray-900">
                                                        {log.user.name || log.user.email}
                                                    </div>
                                                ) : (
                                                    <span className="text-sm text-gray-500 italic">System</span>
                                                )}
                                            </td>
                                            <td className="py-3 px-4 whitespace-nowrap">
                                                <button
                                                    onClick={() => setSelectedLog(log)}
                                                    className="text-brand-primary hover:text-brand-accent text-sm font-medium"
                                                >
                                                    View Details
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination */}
                        {pagination.totalPages > 1 && (
                            <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-t">
                                <div className="text-sm text-gray-600">
                                    Showing {((pagination.page - 1) * pagination.limit) + 1} - {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}
                                </div>
                                <div className="flex items-center space-x-1">
                                    <Button
                                        onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                                        disabled={pagination.page === 1}
                                        variant="outline"
                                        size="sm"
                                    >
                                        Previous
                                    </Button>
                                    {getPaginationRange().map((page, idx) =>
                                        page === "..." ? (
                                            <span key={idx} className="px-3 py-1 text-gray-500">...</span>
                                        ) : (
                                            <Button
                                                key={idx}
                                                onClick={() => setPagination(prev => ({ ...prev, page: page as number }))}
                                                variant={pagination.page === page ? undefined : "outline"}
                                                size="sm"
                                            >
                                                {page}
                                            </Button>
                                        )
                                    )}
                                    <Button
                                        onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                                        disabled={pagination.page === pagination.totalPages}
                                        variant="outline"
                                        size="sm"
                                    >
                                        Next
                                    </Button>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Detail Modal */}
            {selectedLog && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                        <div className="p-6 border-b flex justify-between items-center">
                            <h2 className="text-xl font-semibold text-gray-800">Audit Log Details</h2>
                            <button
                                onClick={() => setSelectedLog(null)}
                                className="text-gray-400 hover:text-gray-600"
                            >
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-sm font-medium text-gray-500">Action</label>
                                    <p className="mt-1">
                                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full border ${actionColors[selectedLog.action] || "bg-gray-100"}`}>
                                            {actionLabels[selectedLog.action] || selectedLog.action}
                                        </span>
                                    </p>
                                </div>
                                <div>
                                    <label className="text-sm font-medium text-gray-500">Entity Type</label>
                                    <p className="mt-1 text-sm text-gray-900">{entityTypeLabels[selectedLog.entityType] || selectedLog.entityType}</p>
                                </div>
                                <div>
                                    <label className="text-sm font-medium text-gray-500">Timestamp</label>
                                    <p className="mt-1 text-sm text-gray-900">{formatDate(selectedLog.createdAt)}</p>
                                </div>
                                <div>
                                    <label className="text-sm font-medium text-gray-500">User</label>
                                    <p className="mt-1 text-sm text-gray-900">
                                        {selectedLog.user?.name || selectedLog.user?.email || "System"}
                                    </p>
                                </div>
                            </div>

                            {selectedLog.entityId && (
                                <div>
                                    <label className="text-sm font-medium text-gray-500">Entity ID</label>
                                    <code className="mt-1 block text-sm bg-gray-100 p-2 rounded">{selectedLog.entityId}</code>
                                </div>
                            )}

                            {selectedLog.description && (
                                <div>
                                    <label className="text-sm font-medium text-gray-500">Description</label>
                                    <p className="mt-1 text-sm text-gray-900 bg-gray-50 p-3 rounded">{selectedLog.description}</p>
                                </div>
                            )}

                            {selectedLog.oldValues && (
                                <div>
                                    <label className="text-sm font-medium text-gray-500">Old Values</label>
                                    <pre className="mt-1 text-xs text-red-700 bg-red-50 p-3 rounded overflow-x-auto">
                                        {selectedLog.oldValues}
                                    </pre>
                                </div>
                            )}

                            {selectedLog.newValues && (
                                <div>
                                    <label className="text-sm font-medium text-gray-500">New Values</label>
                                    <pre className="mt-1 text-xs text-green-700 bg-green-50 p-3 rounded overflow-x-auto">
                                        {selectedLog.newValues}
                                    </pre>
                                </div>
                            )}

                            {selectedLog.ipAddress && (
                                <div>
                                    <label className="text-sm font-medium text-gray-500">IP Address</label>
                                    <p className="mt-1 text-sm text-gray-900 font-mono">{selectedLog.ipAddress}</p>
                                </div>
                            )}

                            {selectedLog.userAgent && (
                                <div>
                                    <label className="text-sm font-medium text-gray-500">User Agent</label>
                                    <p className="mt-1 text-xs text-gray-600 break-all">{selectedLog.userAgent}</p>
                                </div>
                            )}
                        </div>
                        <div className="p-6 border-t bg-gray-50">
                            <Button onClick={() => setSelectedLog(null)} variant="outline" className="w-full">
                                Close
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
