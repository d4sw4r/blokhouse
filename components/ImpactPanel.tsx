"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Callout } from "@/components/ui/Callout";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusDot } from "@/components/ui/StatusDot";
import { Skeleton } from "@/components/Skeleton";
import { IMPACT_MAX_ITEMS } from "@/lib/impact";
import { relationType } from "@/lib/ui/relationTypes";

interface PathItem {
    id: string;
    name: string;
}

interface AffectedItem {
    id: string;
    name: string;
    ip: string | null;
    status: string;
    itemType: { name: string } | null;
    depth: number;
    relationType: string;
    /** From the failed item to this one, inclusive. */
    path: PathItem[];
}

interface ImpactData {
    affected: AffectedItem[];
    truncated: boolean;
}

/** Result for one item id; while `forId` differs from the current id the panel is loading. */
type LoadState =
    | { forId: string | null; status: "loading" }
    | { forId: string; status: "loaded"; data: ImpactData }
    | { forId: string; status: "error"; message: string };

/**
 * How the affected item relates to the one before it on the path. Relation labels describe the
 * stored relation (source -> target); for CONTAINS the affected item is the target, so it reads
 * "Contained in".
 */
function relationPhrase(type: string): { tone: ReturnType<typeof relationType>["tone"]; label: string } {
    const t = relationType(type);
    return type === "CONTAINS" ? { tone: t.tone, label: "Contained in" } : t;
}

function AffectedRow({ item }: { item: AffectedItem }) {
    const previous = item.path[item.path.length - 2];
    const via = item.path.slice(1, -1);
    const relation = relationPhrase(item.relationType);
    return (
        <li className="min-w-0 rounded-lg border border-border bg-surface-2 p-3">
            <div className="flex flex-wrap items-center gap-2 text-sm">
                <Link href={`/items/${item.id}`} className="min-w-0 font-mono break-all text-accent hover:underline">
                    {item.name}
                </Link>
                <Badge>{item.itemType?.name || "No type"}</Badge>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                <span className="inline-flex min-w-0 flex-wrap items-center gap-2">
                    <Badge tone={relation.tone}>{relation.label}</Badge>
                    {previous && <span className="font-mono break-all text-text">{previous.name}</span>}
                </span>
                {item.ip && <span className="font-mono break-all">{item.ip}</span>}
                <StatusDot status={item.status} size="xs" />
            </div>
            {via.length > 0 && (
                <p className="mt-1 text-xs break-words text-muted">
                    via <span className="font-mono">{via.map((p) => p.name).join(" → ")}</span>
                </p>
            )}
        </li>
    );
}

function Group({ title, items }: { title: string; items: AffectedItem[] }) {
    if (items.length === 0) return null;
    return (
        <section className="min-w-0">
            <h3 className="mb-2 text-xs font-medium text-muted">
                {title} ({items.length})
            </h3>
            <ul className="space-y-2">
                {items.map((item) => (
                    <AffectedRow key={item.id} item={item} />
                ))}
            </ul>
        </section>
    );
}

export default function ImpactPanel({ itemId }: { itemId: string }) {
    const [state, setState] = useState<LoadState>({ forId: null, status: "loading" });

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const res = await fetch(`/api/configuration-items/${itemId}/impact`);
                const body = await res.json().catch(() => null);
                if (cancelled) return;
                if (!res.ok) {
                    setState({ forId: itemId, status: "error", message: body?.error || "Failed to compute impact" });
                    return;
                }
                setState({ forId: itemId, status: "loaded", data: body as ImpactData });
            } catch {
                if (!cancelled) setState({ forId: itemId, status: "error", message: "Network error while loading impact" });
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [itemId]);

    if (state.forId !== itemId || state.status === "loading") {
        return (
            <div className="space-y-2" role="status" aria-label="Loading impact">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
            </div>
        );
    }

    if (state.status === "error") {
        return (
            <Callout tone="danger" title="Could not load impact">
                {state.message}
            </Callout>
        );
    }

    const { affected, truncated } = state.data;
    if (affected.length === 0) {
        return (
            <EmptyState
                icon={ShieldCheck}
                title="Nothing depends on this item."
                description="Items that depend on it, run on it or are contained in it would be listed here."
            />
        );
    }

    const direct = affected.filter((a) => a.depth === 1);
    const indirect = affected.filter((a) => a.depth >= 2);
    return (
        <div className="min-w-0 space-y-4">
            <p className="text-sm text-muted">
                {affected.length} {affected.length === 1 ? "item" : "items"} affected
            </p>
            {truncated && (
                <Callout tone="warning">Showing the first {IMPACT_MAX_ITEMS} affected items.</Callout>
            )}
            <Group title="Direct" items={direct} />
            <Group title="Indirect" items={indirect} />
        </div>
    );
}
