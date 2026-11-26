"use client";

import { useState, useEffect, useCallback } from "react";
import { Download, Lock, ScrollText, Search } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Dialog, DialogContent } from "@/components/ui/Dialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { PageHeader } from "@/components/ui/PageHeader";
import { Panel } from "@/components/ui/Panel";
import { Select } from "@/components/ui/Select";
import { StatTile } from "@/components/ui/StatTile";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/Table";
import { SkeletonTable } from "@/components/Skeleton";
import { useToast } from "@/components/ToastProvider";
import { AUDIT_ACTIONS, auditAction } from "@/lib/ui/auditActions";

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

const entityTypeLabels: Record<string, string> = {
    ConfigurationItem: "Asset",
    User: "User",
    ApiToken: "API Token",
    Tag: "Tag",
    ItemType: "Type",
    CustomField: "Custom Field",
    AssetRelation: "Relation",
};

function ActionBadge({ action }: { action: string }) {
    const { tone, label } = auditAction(action);
    return <Badge tone={tone}>{label}</Badge>;
}

export default function AuditLogsPage() {
    const { addToast } = useToast();
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
    const [, setDebouncedSearch] = useState("");

    // Detail modal state
    const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

    // Available filter options
    const actionTypes = AUDIT_ACTIONS;
    const entityTypes = ["ConfigurationItem", "User", "ApiToken", "Tag", "ItemType", "CustomField", "AssetRelation"];

    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(searchQuery);
            setPagination(prev => ({ ...prev, page: 1 }));
        }, 300);
        return () => clearTimeout(timer);
    }, [searchQuery]);

    const fetchLogs = useCallback(async () => {
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
    }, [pagination.page, pagination.limit, actionFilter, entityTypeFilter]);

    useEffect(() => {
        fetchLogs();
    }, [fetchLogs]);

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
                addToast({ type: "error", title: "Failed to export logs" });
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
            addToast({ type: "error", title: "Export failed" });
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
            <div>
                <PageHeader title="Audit log" />
                <EmptyState icon={Lock} title="Access Denied" description={error} />
            </div>
        );
    }

    return (
        <div>
            <PageHeader
                title="Audit log"
                description="Track all changes and activities in the system."
                actions={
                    <>
                        <Button onClick={() => exportLogs("csv")} variant="secondary">
                            <Download className="size-4" aria-hidden="true" />
                            Export CSV
                        </Button>
                        <Button onClick={() => exportLogs("json")} variant="secondary">
                            <Download className="size-4" aria-hidden="true" />
                            Export JSON
                        </Button>
                    </>
                }
            />

            <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
                <StatTile label="Total logs" value={pagination.total.toLocaleString()} />
                <StatTile
                    label="Current page"
                    value={
                        <>
                            {pagination.page} <span className="text-sm font-normal text-muted">/ {pagination.totalPages}</span>
                        </>
                    }
                />
                <StatTile
                    label="Showing"
                    value={
                        <>
                            {logs.length} <span className="text-sm font-normal text-muted">logs</span>
                        </>
                    }
                />
            </div>

            <Panel className="mb-6">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
                    <Field label="Search" htmlFor="audit-search" className="lg:col-span-2">
                        <div className="relative">
                            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" aria-hidden="true" />
                            <Input
                                id="audit-search"
                                type="text"
                                placeholder="Search description, user..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-9"
                            />
                        </div>
                    </Field>
                    <Field label="Action type" htmlFor="audit-action">
                        <Select
                            id="audit-action"
                            value={actionFilter}
                            onValueChange={setActionFilter}
                            options={[
                                { value: "", label: "All Actions" },
                                ...actionTypes.map((a) => ({ value: a, label: auditAction(a).label })),
                            ]}
                        />
                    </Field>
                    <Field label="Entity type" htmlFor="audit-entity">
                        <Select
                            id="audit-entity"
                            value={entityTypeFilter}
                            onValueChange={setEntityTypeFilter}
                            options={[
                                { value: "", label: "All Entities" },
                                ...entityTypes.map((t) => ({ value: t, label: entityTypeLabels[t] || t })),
                            ]}
                        />
                    </Field>
                    <Field label="Per page" htmlFor="audit-limit">
                        <Select
                            id="audit-limit"
                            value={String(pagination.limit)}
                            onValueChange={(v) => setPagination((prev) => ({ ...prev, limit: parseInt(v), page: 1 }))}
                            options={["25", "50", "100"].map((n) => ({ value: n, label: n }))}
                        />
                    </Field>
                </div>
                <div className="mt-4">
                    <Button onClick={clearFilters} variant="secondary">
                        Clear Filters
                    </Button>
                </div>
            </Panel>

            {loading ? (
                <SkeletonTable rows={10} />
            ) : logs.length === 0 ? (
                <EmptyState
                    icon={ScrollText}
                    title="No logs found"
                    description={
                        actionFilter || entityTypeFilter || searchQuery
                            ? "Try adjusting your filters"
                            : "No audit logs available yet"
                    }
                />
            ) : (
                <div className="space-y-3">
                    <Table>
                        <THead>
                            <tr>
                                <TH>Time</TH>
                                <TH>Action</TH>
                                <TH>Entity</TH>
                                <TH>Description</TH>
                                <TH>User</TH>
                                <TH className="relative"><span className="sr-only">Details</span></TH>
                            </tr>
                        </THead>
                        <TBody>
                            {logs.map((log) => (
                                <TR key={log.id}>
                                    <TD className="whitespace-nowrap">
                                        <div title={formatDate(log.createdAt)}>{formatTimeAgo(log.createdAt)}</div>
                                        <div className="text-xs text-muted">{new Date(log.createdAt).toLocaleDateString()}</div>
                                    </TD>
                                    <TD className="whitespace-nowrap"><ActionBadge action={log.action} /></TD>
                                    <TD className="whitespace-nowrap">
                                        <div>{entityTypeLabels[log.entityType] || log.entityType}</div>
                                        {log.entityId && (
                                            <code className="font-mono text-xs text-muted">{log.entityId.slice(0, 8)}...</code>
                                        )}
                                    </TD>
                                    <TD>
                                        <div
                                            className="max-w-md truncate"
                                            title={log.description || `${log.action} ${log.entityType}`}
                                        >
                                            {log.description || `${log.action} ${log.entityType}`}
                                        </div>
                                    </TD>
                                    <TD className="whitespace-nowrap">
                                        {log.user ? (
                                            <span>{log.user.name || log.user.email}</span>
                                        ) : (
                                            <span className="text-muted italic">System</span>
                                        )}
                                    </TD>
                                    <TD className="whitespace-nowrap">
                                        <Button size="sm" variant="secondary" onClick={() => setSelectedLog(log)}>
                                            View Details
                                        </Button>
                                    </TD>
                                </TR>
                            ))}
                        </TBody>
                    </Table>

                    {pagination.totalPages > 1 && (
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="font-mono text-sm text-muted">
                                Showing {((pagination.page - 1) * pagination.limit) + 1} - {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}
                            </div>
                            <div className="flex flex-wrap items-center gap-1">
                                <Button
                                    onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                                    disabled={pagination.page === 1}
                                    variant="secondary"
                                    size="sm"
                                >
                                    Previous
                                </Button>
                                {getPaginationRange().map((page, idx) =>
                                    page === "..." ? (
                                        <span key={idx} className="px-2 text-muted">...</span>
                                    ) : (
                                        <Button
                                            key={idx}
                                            onClick={() => setPagination(prev => ({ ...prev, page: page as number }))}
                                            variant={pagination.page === page ? "primary" : "secondary"}
                                            size="sm"
                                            aria-current={pagination.page === page ? "page" : undefined}
                                        >
                                            {page}
                                        </Button>
                                    )
                                )}
                                <Button
                                    onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                                    disabled={pagination.page === pagination.totalPages}
                                    variant="secondary"
                                    size="sm"
                                >
                                    Next
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            <Dialog open={selectedLog !== null} onOpenChange={(open) => !open && setSelectedLog(null)}>
                {selectedLog && (
                    <DialogContent
                        title="Audit Log Details"
                        className="max-w-2xl"
                        footer={<Button variant="secondary" onClick={() => setSelectedLog(null)}>Close</Button>}
                    >
                        <div className="space-y-4">
                            <dl className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                    <dt className="text-xs font-medium text-muted">Action</dt>
                                    <dd className="mt-1"><ActionBadge action={selectedLog.action} /></dd>
                                </div>
                                <div>
                                    <dt className="text-xs font-medium text-muted">Entity Type</dt>
                                    <dd className="mt-1">{entityTypeLabels[selectedLog.entityType] || selectedLog.entityType}</dd>
                                </div>
                                <div>
                                    <dt className="text-xs font-medium text-muted">Timestamp</dt>
                                    <dd className="mt-1">{formatDate(selectedLog.createdAt)}</dd>
                                </div>
                                <div className="min-w-0">
                                    <dt className="text-xs font-medium text-muted">User</dt>
                                    <dd className="mt-1 break-words">{selectedLog.user?.name || selectedLog.user?.email || "System"}</dd>
                                </div>
                            </dl>

                            {selectedLog.entityId && (
                                <div>
                                    <div className="text-xs font-medium text-muted">Entity ID</div>
                                    <code className="mt-1 block rounded-md bg-surface-2 p-2 font-mono text-sm break-all">{selectedLog.entityId}</code>
                                </div>
                            )}

                            {selectedLog.description && (
                                <div>
                                    <div className="text-xs font-medium text-muted">Description</div>
                                    <p className="mt-1 rounded-md bg-surface-2 p-3 text-sm break-words">{selectedLog.description}</p>
                                </div>
                            )}

                            {selectedLog.oldValues && (
                                <div>
                                    <div className="text-xs font-medium text-muted">Old Values</div>
                                    <pre className="mt-1 overflow-x-auto rounded-md border border-danger/40 bg-danger/10 p-3 font-mono text-xs text-text">
                                        {selectedLog.oldValues}
                                    </pre>
                                </div>
                            )}

                            {selectedLog.newValues && (
                                <div>
                                    <div className="text-xs font-medium text-muted">New Values</div>
                                    <pre className="mt-1 overflow-x-auto rounded-md border border-success/40 bg-success/10 p-3 font-mono text-xs text-text">
                                        {selectedLog.newValues}
                                    </pre>
                                </div>
                            )}

                            {selectedLog.ipAddress && (
                                <div>
                                    <div className="text-xs font-medium text-muted">IP Address</div>
                                    <p className="mt-1 font-mono text-sm break-all">{selectedLog.ipAddress}</p>
                                </div>
                            )}

                            {selectedLog.userAgent && (
                                <div>
                                    <div className="text-xs font-medium text-muted">User Agent</div>
                                    <p className="mt-1 text-xs break-all text-muted">{selectedLog.userAgent}</p>
                                </div>
                            )}
                        </div>
                    </DialogContent>
                )}
            </Dialog>
        </div>
    );
}
