"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { CheckCircle2, RefreshCw, TriangleAlert } from "lucide-react";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { Panel } from "@/components/ui/Panel";
import { Select } from "@/components/ui/Select";
import { StatusDot } from "@/components/ui/StatusDot";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/Table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/Tabs";
import { SkeletonCard, SkeletonActivity } from "@/components/Skeleton";
import { statusTone } from "@/lib/ui/status";

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

const actionTones: Record<string, BadgeTone> = {
    CREATE: "accent",
    UPDATE: "warning",
    DELETE: "danger",
    LOGIN: "success",
    LOGOUT: "neutral",
};

const relationTones: Record<string, BadgeTone> = {
    DEPENDS_ON: "danger",
    RUNS_ON: "accent",
    CONNECTED_TO: "success",
    CONTAINS: "neutral",
};

const statusFill: Record<string, string> = {
    success: "bg-success",
    warning: "bg-warning",
    neutral: "bg-neutral",
};

const periodOptions = [
    { value: "7", label: "Last 7 days" },
    { value: "30", label: "Last 30 days" },
    { value: "90", label: "Last 90 days" },
    { value: "365", label: "Last year" },
];

/** Bar with a visible numeric label next to it, so the value never depends on bar length or colour. */
function Bar({ percent, className = "bg-accent" }: { percent: number; className?: string }) {
    return (
        <div className="h-2 w-24 shrink-0 overflow-hidden rounded-full bg-surface-2" aria-hidden="true">
            <div className={`h-2 rounded-full ${className}`} style={{ width: `${percent}%` }} />
        </div>
    );
}

export default function ReportsPage() {
    const [data, setData] = useState<ReportsData | null>(null);
    const [loading, setLoading] = useState(true);
    const [period, setPeriod] = useState(30);
    const [activeTab, setActiveTab] = useState<"overview" | "orphaned" | "users">("overview");

    useEffect(() => {
        fetchReports();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [period]); // fetchReports is a stable function declaration

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
            <div>
                <PageHeader title="Reports & Analytics" />
                <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-4">
                    {[...Array(4)].map((_, i) => (
                        <SkeletonCard key={i} />
                    ))}
                </div>
                <SkeletonActivity />
            </div>
        );
    }

    const untyped = data.itemsByType.filter((t) => t.typeId === null).reduce((a, b) => a + b.count, 0);
    const unusedTags = data.tagsDistribution.filter((t) => t.count === 0).length;
    const emptyText = (text: string) => <p className="text-sm text-muted">{text}</p>;

    return (
        <div>
            <PageHeader
                title="Reports & Analytics"
                description="Comprehensive insights into your CMDB data"
                actions={
                    <>
                        <div className="w-40">
                            <Select
                                aria-label="Reporting period"
                                value={String(period)}
                                onValueChange={(v) => setPeriod(Number(v))}
                                options={periodOptions}
                            />
                        </div>
                        <Button onClick={fetchReports} variant="secondary">
                            <RefreshCw className="size-4" aria-hidden="true" />
                            Refresh
                        </Button>
                    </>
                }
            />

            <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
                <div className="min-w-0 rounded-lg border border-border bg-surface p-4">
                    <div className="text-xs font-medium text-muted">Total Assets</div>
                    <div className="mt-1 font-mono text-2xl font-semibold tabular-nums">{data.totals.items}</div>
                    <div className="mt-2 flex flex-wrap gap-x-2 gap-y-0.5 text-xs text-muted">
                        <span><span className="font-mono">{data.totals.active}</span> active</span>
                        <span aria-hidden="true">|</span>
                        <span><span className="font-mono">{data.totals.maintenance}</span> maint</span>
                        <span aria-hidden="true">|</span>
                        <span><span className="font-mono">{data.totals.deprecated}</span> depr</span>
                    </div>
                </div>
                <div className="min-w-0 rounded-lg border border-border bg-surface p-4">
                    <div className="text-xs font-medium text-muted">Asset Types</div>
                    <div className="mt-1 font-mono text-2xl font-semibold tabular-nums">{data.totals.types}</div>
                    <p className="mt-2 text-xs text-muted">
                        <span className="font-mono">{untyped}</span> untyped assets
                    </p>
                </div>
                <div className="min-w-0 rounded-lg border border-border bg-surface p-4">
                    <div className="text-xs font-medium text-muted">Tags</div>
                    <div className="mt-1 font-mono text-2xl font-semibold tabular-nums">{data.totals.tags}</div>
                    <p className="mt-2 text-xs text-muted">
                        <span className="font-mono">{unusedTags}</span> unused tags
                    </p>
                </div>
                <div className="min-w-0 rounded-lg border border-border bg-surface p-4">
                    <div className="text-xs font-medium text-muted">Relations</div>
                    <div className="mt-1 font-mono text-2xl font-semibold tabular-nums">{data.totals.relations}</div>
                    <p className="mt-2 text-xs text-muted">
                        Across <span className="font-mono">{data.itemsByType.length}</span> types
                    </p>
                </div>
            </div>

            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
                <TabsList>
                    <TabsTrigger value="overview">Overview</TabsTrigger>
                    <TabsTrigger value="orphaned">Data Quality</TabsTrigger>
                    <TabsTrigger value="users">Users</TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="space-y-6 pt-6">
                    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                        <Panel title="Asset Status Distribution">
                            <div className="space-y-4">
                                {data.itemsByStatus.map((status) => {
                                    const percentage = getPercentage(status.count, data.totals.items);
                                    const { tone } = statusTone(status.status);
                                    return (
                                        <div key={status.status}>
                                            <div className="mb-1 flex justify-between gap-2 text-sm">
                                                <StatusDot status={status.status} />
                                                <span className="font-mono text-muted">
                                                    {status.count} ({percentage}%)
                                                </span>
                                            </div>
                                            <div className="h-3 w-full overflow-hidden rounded-full bg-surface-2" aria-hidden="true">
                                                <div
                                                    className={`h-3 rounded-full ${statusFill[tone]}`}
                                                    style={{ width: `${percentage}%` }}
                                                />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </Panel>

                        <Panel title="Tag Usage">
                            {data.tagsDistribution.length === 0 ? (
                                emptyText("No tags created yet.")
                            ) : (
                                <div className="max-h-64 space-y-3 overflow-y-auto">
                                    {data.tagsDistribution
                                        .sort((a, b) => b.count - a.count)
                                        .map((tag) => (
                                            <div key={tag.id} className="flex items-center justify-between gap-3">
                                                <div className="flex min-w-0 items-center gap-2">
                                                    <span
                                                        className="size-3 shrink-0 rounded-full border border-border"
                                                        style={tag.color ? { backgroundColor: tag.color } : undefined}
                                                        aria-hidden="true"
                                                    />
                                                    <span className="truncate text-sm font-medium" title={tag.name}>
                                                        {tag.name}
                                                    </span>
                                                </div>
                                                <div className="flex shrink-0 items-center gap-2">
                                                    <Bar percent={getPercentage(tag.count, data.totals.items)} />
                                                    <span className="w-8 text-right font-mono text-xs text-muted">{tag.count}</span>
                                                </div>
                                            </div>
                                        ))}
                                </div>
                            )}
                        </Panel>
                    </div>

                    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                        <Panel title="Assets by Type">
                            {data.itemsByType.length === 0 ? (
                                emptyText("No types assigned.")
                            ) : (
                                <div className="max-h-64 space-y-3 overflow-y-auto">
                                    {data.itemsByType
                                        .sort((a, b) => b.count - a.count)
                                        .map((type) => (
                                            <div key={type.typeId || "untyped"} className="flex items-center justify-between gap-3">
                                                <span className="min-w-0 truncate text-sm font-medium" title={type.typeName}>
                                                    {type.typeName}
                                                </span>
                                                <div className="flex shrink-0 items-center gap-2">
                                                    <Bar percent={getPercentage(type.count, data.totals.items)} />
                                                    <span className="w-8 text-right font-mono text-xs text-muted">{type.count}</span>
                                                </div>
                                            </div>
                                        ))}
                                </div>
                            )}
                        </Panel>

                        <Panel title="Relation Types">
                            {data.relationStats.length === 0 ? (
                                emptyText("No relations created yet.")
                            ) : (
                                <div className="space-y-3">
                                    {data.relationStats.map((rel) => (
                                        <div key={rel.type} className="flex items-center justify-between gap-3">
                                            <Badge tone={relationTones[rel.type] || "neutral"}>
                                                {rel.type.replace(/_/g, " ")}
                                            </Badge>
                                            <span className="font-mono text-sm font-medium">{rel.count}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </Panel>
                    </div>

                    <Panel title="Recent Activity">
                        {data.recentActivity.length === 0 ? (
                            emptyText("No activity in the selected period.")
                        ) : (
                            <div className="space-y-2">
                                {data.recentActivity.map((activity) => (
                                    <div key={activity.id} className="flex items-start gap-3 rounded-md bg-surface-2 p-3">
                                        <Badge tone={actionTones[activity.action] || "neutral"} className="shrink-0">
                                            {activity.action}
                                        </Badge>
                                        <div className="min-w-0 flex-1">
                                            <p className="text-sm break-words text-text">
                                                {activity.description || `${activity.action} ${activity.entityType}`}
                                            </p>
                                            <p className="mt-1 text-xs text-muted">
                                                by {activity.user?.name || activity.user?.email || "System"} • {formatDate(activity.createdAt)}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </Panel>
                </TabsContent>

                <TabsContent value="orphaned" className="space-y-6 pt-6">
                    <div className="rounded-lg border border-warning/40 bg-warning/10 p-4">
                        <h3 className="flex items-center gap-2 text-sm font-semibold text-text">
                            <TriangleAlert className="size-4 text-warning" aria-hidden="true" />
                            Data Quality Issues
                        </h3>
                        <p className="mt-1 text-sm text-muted">
                            Found <span className="font-mono">{data.orphanedAssets.length}</span> assets with incomplete data.
                            These assets are missing type assignments or tags.
                        </p>
                    </div>

                    {data.orphanedAssets.length === 0 ? (
                        <div className="flex flex-col items-center gap-2 rounded-lg border border-success/40 bg-success/10 p-8 text-center">
                            <CheckCircle2 className="size-8 text-success" aria-hidden="true" />
                            <h3 className="text-sm font-semibold text-text">All Clear!</h3>
                            <p className="text-sm text-muted">All assets have proper type and tag assignments.</p>
                        </div>
                    ) : (
                        <Table>
                            <THead>
                                <TR>
                                    <TH>Asset Name</TH>
                                    <TH>Status</TH>
                                    <TH>Missing</TH>
                                    <TH>Created</TH>
                                    <TH>Action</TH>
                                </TR>
                            </THead>
                            <TBody>
                                {data.orphanedAssets.map((asset) => (
                                    <TR key={asset.id}>
                                        <TD mono className="max-w-[16rem] truncate" title={asset.name}>{asset.name}</TD>
                                        <TD><StatusDot status={asset.status} /></TD>
                                        <TD>
                                            <div className="flex gap-2">
                                                {asset.missingType && <Badge tone="danger">Type</Badge>}
                                                {asset.missingTags && <Badge tone="warning">Tags</Badge>}
                                            </div>
                                        </TD>
                                        <TD className="whitespace-nowrap text-muted">{formatDate(asset.createdAt)}</TD>
                                        <TD>
                                            <Link href={`/items/${asset.id}`}>
                                                <Button size="sm" variant="secondary" tabIndex={-1}>Edit</Button>
                                            </Link>
                                        </TD>
                                    </TR>
                                ))}
                            </TBody>
                        </Table>
                    )}
                </TabsContent>

                <TabsContent value="users" className="space-y-6 pt-6">
                    <Panel title={`Top Contributors (${data.totals.users} total users)`}>
                        {data.userStats.length === 0 ? (
                            emptyText("No user activity recorded.")
                        ) : (
                            <div className="space-y-3">
                                {data.userStats.map((user, index) => (
                                    <div key={user.id} className="flex items-center gap-4 rounded-md bg-surface-2 p-3">
                                        <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent font-mono text-sm font-semibold text-accent-fg">
                                            {index + 1}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="truncate text-sm font-medium" title={user.name || user.email || "Unknown"}>
                                                {user.name || user.email || "Unknown"}
                                            </p>
                                            <p className="truncate text-xs text-muted" title={user.email ?? undefined}>{user.email}</p>
                                        </div>
                                        <div className="flex shrink-0 gap-5 text-sm">
                                            <div className="text-center">
                                                <p className="font-mono font-semibold">{user.itemCount}</p>
                                                <p className="text-xs text-muted">Assets</p>
                                            </div>
                                            <div className="text-center">
                                                <p className="font-mono font-semibold">{user.activityCount}</p>
                                                <p className="text-xs text-muted">Activities</p>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </Panel>

                    <Panel title={`Activity Summary (Last ${period} Days)`}>
                        {data.activityByAction.length === 0 ? (
                            emptyText("No activity recorded in this period.")
                        ) : (
                            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                                {data.activityByAction.map((activity) => (
                                    <div key={activity.action} className="rounded-md bg-surface-2 p-4 text-center">
                                        <p className="font-mono text-2xl font-semibold">{activity.count}</p>
                                        <Badge tone={actionTones[activity.action] || "neutral"} className="mt-1">
                                            {activity.action}
                                        </Badge>
                                    </div>
                                ))}
                            </div>
                        )}
                    </Panel>
                </TabsContent>
            </Tabs>
        </div>
    );
}
