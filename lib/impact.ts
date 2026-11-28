export const IMPACT_MAX_DEPTH = 10;
export const IMPACT_MAX_ITEMS = 500;

export interface ImpactEdge {
    sourceId: string;
    targetId: string;
    type: string;
}

export interface ImpactNode {
    id: string;
    depth: number;
    via: { fromId: string; type: string };
    /** Ids from the failed item to this one, inclusive. */
    path: string[];
}

/**
 * If `failedId` fails, which item does this edge affect? Returns its id, or null.
 * Y DEPENDS_ON X and Y RUNS_ON X: X failing affects Y. X CONTAINS Y: X failing affects Y.
 */
export function affectedBy(edge: ImpactEdge, failedId: string): string | null {
    if ((edge.type === "DEPENDS_ON" || edge.type === "RUNS_ON") && edge.targetId === failedId) {
        return edge.sourceId;
    }
    if (edge.type === "CONTAINS" && edge.sourceId === failedId) {
        return edge.targetId;
    }
    return null;
}

/**
 * Breadth-first impact traversal. `loadEdges(ids)` returns the relations touching `ids`
 * (called once per depth level). Stops at IMPACT_MAX_DEPTH levels or IMPACT_MAX_ITEMS
 * nodes and reports `truncated` if anything was left out.
 */
export async function computeImpact(
    rootId: string,
    loadEdges: (ids: string[]) => Promise<ImpactEdge[]>
): Promise<{ nodes: ImpactNode[]; truncated: boolean }> {
    const nodes: ImpactNode[] = [];
    const visited = new Set<string>([rootId]);
    const paths = new Map<string, string[]>([[rootId, [rootId]]]);
    let frontier = [rootId];
    let truncated = false;

    for (let depth = 1; frontier.length > 0; depth++) {
        const edges = await loadEdges(frontier);
        const next: string[] = [];

        for (const failedId of frontier) {
            for (const edge of edges) {
                const affectedId = affectedBy(edge, failedId);
                if (affectedId === null || visited.has(affectedId)) continue;
                if (depth > IMPACT_MAX_DEPTH || nodes.length >= IMPACT_MAX_ITEMS) {
                    truncated = true;
                    continue;
                }
                visited.add(affectedId);
                const path = [...paths.get(failedId)!, affectedId];
                paths.set(affectedId, path);
                nodes.push({ id: affectedId, depth, via: { fromId: failedId, type: edge.type }, path });
                next.push(affectedId);
            }
        }

        if (truncated) break;
        frontier = next;
    }

    return { nodes, truncated };
}
