import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
    default: {
        configurationItem: { findUnique: vi.fn(), findMany: vi.fn() },
        assetRelation: { findMany: vi.fn() },
    },
}));
vi.mock("next-auth/next", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/authOptions", () => ({ default: {} }));

import { computeImpact, affectedBy, IMPACT_MAX_DEPTH, IMPACT_MAX_ITEMS } from "../lib/impact";
import { GET } from "../app/api/configuration-items/[id]/impact/route.js";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth/next";

const e = (sourceId, targetId, type) => ({ sourceId, targetId, type });

// In-memory loader mimicking the prisma query
function loaderFor(edges) {
    return vi.fn(async (ids) =>
        edges.filter(
            (x) =>
                ((x.type === "DEPENDS_ON" || x.type === "RUNS_ON") && ids.includes(x.targetId)) ||
                (x.type === "CONTAINS" && ids.includes(x.sourceId))
        )
    );
}

describe("affectedBy", () => {
    it("maps edges by direction", () => {
        expect(affectedBy(e("B", "A", "DEPENDS_ON"), "A")).toBe("B");
        expect(affectedBy(e("B", "A", "RUNS_ON"), "A")).toBe("B");
        expect(affectedBy(e("A", "D", "CONTAINS"), "A")).toBe("D");
        expect(affectedBy(e("D", "A", "CONTAINS"), "A")).toBeNull();
        expect(affectedBy(e("A", "B", "DEPENDS_ON"), "A")).toBeNull();
        expect(affectedBy(e("B", "A", "MANAGES"), "A")).toBeNull();
    });
});

describe("computeImpact", () => {
    it("walks a chain with depth and path", async () => {
        const load = loaderFor([e("B", "A", "DEPENDS_ON"), e("C", "B", "RUNS_ON")]);
        const { nodes, truncated } = await computeImpact("A", load);
        expect(truncated).toBe(false);
        expect(nodes).toEqual([
            { id: "B", depth: 1, via: { fromId: "A", type: "DEPENDS_ON" }, path: ["A", "B"] },
            { id: "C", depth: 2, via: { fromId: "B", type: "RUNS_ON" }, path: ["A", "B", "C"] },
        ]);
    });

    it("follows CONTAINS only from container to contained", async () => {
        const down = await computeImpact("A", loaderFor([e("A", "D", "CONTAINS")]));
        expect(down.nodes.map((n) => n.id)).toEqual(["D"]);
        const up = await computeImpact("A", loaderFor([e("D", "A", "CONTAINS")]));
        expect(up.nodes).toEqual([]);
    });

    it("ignores CONNECTED_TO, MANAGES and PART_OF", async () => {
        const load = loaderFor([
            e("B", "A", "CONNECTED_TO"),
            e("A", "C", "CONNECTED_TO"),
            e("B", "A", "MANAGES"),
            e("B", "A", "PART_OF"),
        ]);
        const { nodes } = await computeImpact("A", load);
        expect(nodes).toEqual([]);
    });

    it("terminates on cycles and never returns the root", async () => {
        const load = loaderFor([e("B", "A", "DEPENDS_ON"), e("A", "B", "DEPENDS_ON")]);
        const { nodes, truncated } = await computeImpact("A", load);
        expect(nodes.map((n) => n.id)).toEqual(["B"]);
        expect(truncated).toBe(false);
    });

    it("lists a diamond's shared node once at depth 2", async () => {
        const load = loaderFor([
            e("B", "A", "DEPENDS_ON"),
            e("C", "A", "DEPENDS_ON"),
            e("D", "B", "DEPENDS_ON"),
            e("D", "C", "DEPENDS_ON"),
        ]);
        const { nodes } = await computeImpact("A", load);
        const d = nodes.filter((n) => n.id === "D");
        expect(d).toHaveLength(1);
        expect(d[0].depth).toBe(2);
        expect(d[0].path).toHaveLength(3);
    });

    it("cuts off beyond max depth and flags truncated", async () => {
        const edges = [];
        for (let i = 0; i < IMPACT_MAX_DEPTH + 2; i++) edges.push(e(`n${i + 1}`, `n${i}`, "DEPENDS_ON"));
        const load = loaderFor(edges);
        const { nodes, truncated } = await computeImpact("n0", load);
        expect(truncated).toBe(true);
        expect(Math.max(...nodes.map((n) => n.depth))).toBe(IMPACT_MAX_DEPTH);
        expect(nodes).toHaveLength(IMPACT_MAX_DEPTH);
    });

    it("does not flag truncated when the chain ends exactly at max depth", async () => {
        const edges = [];
        for (let i = 0; i < IMPACT_MAX_DEPTH; i++) edges.push(e(`n${i + 1}`, `n${i}`, "DEPENDS_ON"));
        const { nodes, truncated } = await computeImpact("n0", loaderFor(edges));
        expect(nodes).toHaveLength(IMPACT_MAX_DEPTH);
        expect(truncated).toBe(false);
    });

    it("caps the number of nodes and flags truncated", async () => {
        const edges = [];
        for (let i = 0; i < IMPACT_MAX_ITEMS + 50; i++) edges.push(e(`x${i}`, "root", "DEPENDS_ON"));
        const { nodes, truncated } = await computeImpact("root", loaderFor(edges));
        expect(nodes).toHaveLength(IMPACT_MAX_ITEMS);
        expect(truncated).toBe(true);
    });

    it("makes one loadEdges call per depth level", async () => {
        const load = loaderFor([e("B", "A", "DEPENDS_ON"), e("C", "B", "DEPENDS_ON")]);
        await computeImpact("A", load);
        expect(load).toHaveBeenCalledTimes(3); // A, B, C(empty)
    });
});

describe("GET /api/configuration-items/[id]/impact", () => {
    beforeEach(() => vi.clearAllMocks());
    const params = (id) => Promise.resolve({ id });
    const req = () => ({ json: vi.fn() });

    it("returns 401 without auth", async () => {
        getServerSession.mockResolvedValue(null);
        const res = await GET(req(), { params: params("A") });
        expect(res.status).toBe(401);
    });

    it("returns 404 for unknown id", async () => {
        getServerSession.mockResolvedValue({ user: { id: "u", role: "USER" } });
        prisma.configurationItem.findUnique.mockResolvedValue(null);
        const res = await GET(req(), { params: params("nope") });
        expect(res.status).toBe(404);
        expect((await res.json()).error).toBe("Configuration item not found");
    });

    it("returns affected items sorted with named paths", async () => {
        getServerSession.mockResolvedValue({ user: { id: "u", role: "USER" } });
        prisma.configurationItem.findUnique.mockResolvedValue({ id: "A", name: "Db" });
        const edges = [e("B", "A", "DEPENDS_ON"), e("C", "B", "RUNS_ON")];
        prisma.assetRelation.findMany.mockImplementation(async ({ where }) => {
            const ids = where.OR[0].targetId.in;
            return edges.filter((x) => ids.includes(x.targetId));
        });
        prisma.configurationItem.findMany.mockResolvedValue([
            { id: "A", name: "Db", ip: null, status: "ACTIVE", itemType: null },
            { id: "B", name: "Api", ip: "10.0.0.2", status: "ACTIVE", itemType: { name: "Server" } },
            { id: "C", name: "Web", ip: null, status: "ACTIVE", itemType: { name: "App" } },
        ]);
        const res = await GET(req(), { params: params("A") });
        const data = await res.json();
        expect(res.status).toBe(200);
        expect(data.item).toEqual({ id: "A", name: "Db" });
        expect(data.truncated).toBe(false);
        expect(data.affected.map((x) => x.id)).toEqual(["B", "C"]);
        expect(data.affected[1]).toEqual({
            id: "C",
            name: "Web",
            ip: null,
            status: "ACTIVE",
            itemType: { name: "App" },
            depth: 2,
            relationType: "RUNS_ON",
            path: [
                { id: "A", name: "Db" },
                { id: "B", name: "Api" },
                { id: "C", name: "Web" },
            ],
        });
    });

    it("loads edges with both relation directions in a stable order", async () => {
        getServerSession.mockResolvedValue({ user: { id: "u", role: "USER" } });
        prisma.configurationItem.findUnique.mockResolvedValue({ id: "A", name: "Db" });
        prisma.assetRelation.findMany.mockResolvedValue([]);
        prisma.configurationItem.findMany.mockResolvedValue([]);
        const res = await GET(req(), { params: params("A") });
        expect(res.status).toBe(200);
        expect(prisma.assetRelation.findMany).toHaveBeenCalledWith({
            where: {
                OR: [
                    { targetId: { in: ["A"] }, type: { in: ["DEPENDS_ON", "RUNS_ON"] } },
                    { sourceId: { in: ["A"] }, type: "CONTAINS" },
                ],
            },
            select: { sourceId: true, targetId: true, type: true },
            orderBy: [{ sourceId: "asc" }, { targetId: "asc" }, { type: "asc" }],
        });
    });
});
