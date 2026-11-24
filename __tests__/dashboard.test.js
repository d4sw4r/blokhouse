import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
    default: {
        configurationItem: { count: vi.fn(), groupBy: vi.fn() },
        itemType: { count: vi.fn(), findMany: vi.fn() },
        tag: { count: vi.fn() },
        assetRelation: { count: vi.fn() },
        maintenanceSchedule: { count: vi.fn() },
        notification: { count: vi.fn() },
        apiToken: { findUnique: vi.fn(), update: vi.fn() },
    },
}));
vi.mock("next-auth/next", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/authOptions", () => ({ default: {} }));

import { GET } from "../app/api/dashboard/route.ts";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth/next";

function req(headers = {}) {
    return new Request("http://localhost:3000/api/dashboard", { headers });
}

function mockCounts() {
    // configurationItem.count: total, then untyped
    prisma.configurationItem.count.mockResolvedValueOnce(100).mockResolvedValueOnce(50);
    prisma.itemType.count.mockResolvedValue(5);
    prisma.configurationItem.groupBy
        .mockResolvedValueOnce([
            { status: "ACTIVE", _count: { id: 80 } },
            { status: "MAINTENANCE", _count: { id: 20 } },
        ])
        .mockResolvedValueOnce([
            { itemTypeId: "type-1", _count: { id: 30 } },
            { itemTypeId: "type-2", _count: { id: 20 } },
            { itemTypeId: null, _count: { id: 50 } },
        ]);
    prisma.itemType.findMany.mockResolvedValue([
        { id: "type-1", name: "Server" },
        { id: "type-2", name: "Database" },
    ]);
    prisma.tag.count.mockResolvedValue(7);
    prisma.assetRelation.count.mockResolvedValue(3);
    prisma.maintenanceSchedule.count.mockResolvedValue(2);
    prisma.notification.count.mockResolvedValue(1);
}

describe("Dashboard API", () => {
    beforeEach(() => {
        vi.resetAllMocks();
    });

    it("returns 401 without authentication", async () => {
        getServerSession.mockResolvedValue(null);
        const res = await GET(req());
        expect(res.status).toBe(401);
        expect(prisma.configurationItem.count).not.toHaveBeenCalled();
    });

    it("returns 401 for an invalid API token (no session fallback)", async () => {
        prisma.apiToken.findUnique.mockResolvedValue(null);
        getServerSession.mockResolvedValue({ user: { id: "u1", role: "ADMIN" } });
        const res = await GET(req({ authorization: "Bearer bh_invalid" }));
        expect(res.status).toBe(401);
    });

    it("returns aggregated statistics for an authenticated user", async () => {
        getServerSession.mockResolvedValue({ user: { id: "u1", role: "READONLY" } });
        mockCounts();

        const res = await GET(req());
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data).toMatchObject({
            totalItems: 100,
            totalTypes: 5,
            untypedItems: 50,
            totalTags: 7,
            totalRelations: 3,
            upcomingMaintenance: 2,
            unreadNotifications: 1,
        });
        expect(data.itemsPerStatus).toEqual([
            { status: "ACTIVE", count: 80 },
            { status: "MAINTENANCE", count: 20 },
        ]);
        expect(data.itemsPerType).toEqual([
            { itemTypeId: "type-1", count: 30, typeName: "Server" },
            { itemTypeId: "type-2", count: 20, typeName: "Database" },
            { itemTypeId: "untyped", count: 50, typeName: "Untyped" },
        ]);
        expect(prisma.notification.count).toHaveBeenCalledWith({ where: { userId: "u1", read: false } });
    });

    it("returns 500 when the database fails", async () => {
        getServerSession.mockResolvedValue({ user: { id: "u1", role: "USER" } });
        prisma.configurationItem.count.mockRejectedValue(new Error("DB down"));
        prisma.itemType.count.mockResolvedValue(0);
        const res = await GET(req());
        expect(res.status).toBe(500);
    });
});
