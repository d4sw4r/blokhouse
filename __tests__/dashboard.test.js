import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { GET } from "../app/api/dashboard/route.js";

// Mock prisma
vi.mock("@/lib/prisma", () => ({
    default: {
        configurationItem: {
            count: vi.fn(),
            groupBy: vi.fn(),
        },
        itemType: {
            count: vi.fn(),
            findUnique: vi.fn(),
        },
    },
}));

import prisma from "@/lib/prisma";

describe("Dashboard API", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.resetAllMocks();
    });

    describe("Successful responses", () => {
        it("returns dashboard data with all required fields", async () => {
            // Mock data
            prisma.configurationItem.count.mockResolvedValueOnce(100);
            prisma.itemType.count.mockResolvedValueOnce(5);
            prisma.configurationItem.groupBy
                .mockResolvedValueOnce([
                    { itemTypeId: "type-1", _count: { id: 30 } },
                    { itemTypeId: "type-2", _count: { id: 20 } },
                    { itemTypeId: null, _count: { id: 50 } },
                ])
                .mockResolvedValueOnce([
                    { status: "ACTIVE", _count: { id: 80 } },
                    { status: "MAINTENANCE", _count: { id: 15 } },
                    { status: "DEPRECATED", _count: { id: 5 } },
                ]);

            prisma.itemType.findUnique
                .mockResolvedValueOnce({ id: "type-1", name: "Server" })
                .mockResolvedValueOnce({ id: "type-2", name: "Database" });

            const response = await GET();
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data).toHaveProperty("totalItems", 100);
            expect(data).toHaveProperty("totalTypes", 5);
            expect(data).toHaveProperty("untypedItems", 50);
            expect(data).toHaveProperty("itemsPerType");
            expect(data).toHaveProperty("itemsPerStatus");
        });

        it("returns correct itemsPerType with type names", async () => {
            prisma.configurationItem.count.mockResolvedValueOnce(50);
            prisma.itemType.count.mockResolvedValueOnce(3);
            prisma.configurationItem.groupBy
                .mockResolvedValueOnce([
                    { itemTypeId: "type-1", _count: { id: 25 } },
                    { itemTypeId: "type-2", _count: { id: 15 } },
                ])
                .mockResolvedValueOnce([
                    { status: "ACTIVE", _count: { id: 40 } },
                ]);

            prisma.itemType.findUnique
                .mockResolvedValueOnce({ id: "type-1", name: "Web Server" })
                .mockResolvedValueOnce({ id: "type-2", name: "API Server" });

            const response = await GET();
            const data = await response.json();

            expect(data.itemsPerType).toHaveLength(2);
            expect(data.itemsPerType[0]).toMatchObject({
                itemTypeId: "type-1",
                count: 25,
                typeName: "Web Server",
            });
            expect(data.itemsPerType[1]).toMatchObject({
                itemTypeId: "type-2",
                count: 15,
                typeName: "API Server",
            });
        });

        it("returns correct itemsPerStatus breakdown", async () => {
            prisma.configurationItem.count.mockResolvedValueOnce(100);
            prisma.itemType.count.mockResolvedValueOnce(3);
            prisma.configurationItem.groupBy
                .mockResolvedValueOnce([
                    { itemTypeId: "type-1", _count: { id: 40 } },
                ])
                .mockResolvedValueOnce([
                    { status: "ACTIVE", _count: { id: 75 } },
                    { status: "MAINTENANCE", _count: { id: 20 } },
                    { status: "DEPRECATED", _count: { id: 5 } },
                ]);

            prisma.itemType.findUnique.mockResolvedValueOnce({ id: "type-1", name: "Server" });

            const response = await GET();
            const data = await response.json();

            expect(data.itemsPerStatus).toHaveLength(3);
            expect(data.itemsPerStatus).toContainEqual({ status: "ACTIVE", count: 75 });
            expect(data.itemsPerStatus).toContainEqual({ status: "MAINTENANCE", count: 20 });
            expect(data.itemsPerStatus).toContainEqual({ status: "DEPRECATED", count: 5 });
        });

        it("handles empty database correctly", async () => {
            prisma.configurationItem.count.mockResolvedValueOnce(0);
            prisma.itemType.count.mockResolvedValueOnce(0);
            prisma.configurationItem.groupBy
                .mockResolvedValueOnce([])
                .mockResolvedValueOnce([]);

            const response = await GET();
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.totalItems).toBe(0);
            expect(data.totalTypes).toBe(0);
            expect(data.untypedItems).toBe(0);
            expect(data.itemsPerType).toEqual([]);
            expect(data.itemsPerStatus).toEqual([]);
        });

        it("handles all untyped items correctly", async () => {
            prisma.configurationItem.count.mockResolvedValueOnce(50);
            prisma.itemType.count.mockResolvedValueOnce(0);
            prisma.configurationItem.groupBy
                .mockResolvedValueOnce([
                    { itemTypeId: null, _count: { id: 50 } },
                ])
                .mockResolvedValueOnce([
                    { status: "ACTIVE", _count: { id: 50 } },
                ]);

            const response = await GET();
            const data = await response.json();

            expect(data.untypedItems).toBe(50);
            expect(data.itemsPerType).toEqual([]);
        });

        it("handles unknown type IDs gracefully", async () => {
            prisma.configurationItem.count.mockResolvedValueOnce(10);
            prisma.itemType.count.mockResolvedValueOnce(1);
            prisma.configurationItem.groupBy
                .mockResolvedValueOnce([
                    { itemTypeId: "deleted-type", _count: { id: 10 } },
                ])
                .mockResolvedValueOnce([
                    { status: "ACTIVE", _count: { id: 10 } },
                ]);

            prisma.itemType.findUnique.mockResolvedValueOnce(null);

            const response = await GET();
            const data = await response.json();

            expect(data.itemsPerType[0].typeName).toBe("Unknown");
        });

        it("returns correct content type header", async () => {
            prisma.configurationItem.count.mockResolvedValueOnce(10);
            prisma.itemType.count.mockResolvedValueOnce(2);
            prisma.configurationItem.groupBy
                .mockResolvedValueOnce([])
                .mockResolvedValueOnce([]);

            const response = await GET();

            expect(response.headers.get("Content-Type")).toBe("application/json");
        });
    });

    describe("Error handling", () => {
        it("returns 500 when database query fails", async () => {
            prisma.configurationItem.count.mockRejectedValueOnce(new Error("Database connection lost"));

            const response = await GET();
            const data = await response.json();

            expect(response.status).toBe(500);
            expect(data.error).toBe("Failed to load dashboard data");
        });

        it("returns 500 when groupBy query fails", async () => {
            prisma.configurationItem.count.mockResolvedValueOnce(10);
            prisma.itemType.count.mockResolvedValueOnce(2);
            prisma.configurationItem.groupBy.mockRejectedValueOnce(new Error("Query timeout"));

            const response = await GET();

            expect(response.status).toBe(500);
        });

        it("returns 500 when itemType lookup fails", async () => {
            prisma.configurationItem.count.mockResolvedValueOnce(10);
            prisma.itemType.count.mockResolvedValueOnce(2);
            prisma.configurationItem.groupBy
                .mockResolvedValueOnce([
                    { itemTypeId: "type-1", _count: { id: 10 } },
                ])
                .mockResolvedValueOnce([]);
            prisma.itemType.findUnique.mockRejectedValueOnce(new Error("Type lookup failed"));

            const response = await GET();

            expect(response.status).toBe(500);
        });
    });

    describe("Data aggregation", () => {
        it("calls configurationItem.count once", async () => {
            prisma.configurationItem.count.mockResolvedValueOnce(0);
            prisma.itemType.count.mockResolvedValueOnce(0);
            prisma.configurationItem.groupBy
                .mockResolvedValueOnce([])
                .mockResolvedValueOnce([]);

            await GET();

            expect(prisma.configurationItem.count).toHaveBeenCalledTimes(1);
        });

        it("calls itemType.count once", async () => {
            prisma.configurationItem.count.mockResolvedValueOnce(0);
            prisma.itemType.count.mockResolvedValueOnce(0);
            prisma.configurationItem.groupBy
                .mockResolvedValueOnce([])
                .mockResolvedValueOnce([]);

            await GET();

            expect(prisma.itemType.count).toHaveBeenCalledTimes(1);
        });

        it("calls groupBy twice (for types and status)", async () => {
            prisma.configurationItem.count.mockResolvedValueOnce(0);
            prisma.itemType.count.mockResolvedValueOnce(0);
            prisma.configurationItem.groupBy
                .mockResolvedValueOnce([])
                .mockResolvedValueOnce([]);

            await GET();

            expect(prisma.configurationItem.groupBy).toHaveBeenCalledTimes(2);
        });

        it("calls findUnique for each typed item group", async () => {
            prisma.configurationItem.count.mockResolvedValueOnce(30);
            prisma.itemType.count.mockResolvedValueOnce(3);
            prisma.configurationItem.groupBy
                .mockResolvedValueOnce([
                    { itemTypeId: "type-1", _count: { id: 10 } },
                    { itemTypeId: "type-2", _count: { id: 10 } },
                    { itemTypeId: "type-3", _count: { id: 10 } },
                ])
                .mockResolvedValueOnce([]);

            prisma.itemType.findUnique
                .mockResolvedValueOnce({ id: "type-1", name: "Type 1" })
                .mockResolvedValueOnce({ id: "type-2", name: "Type 2" })
                .mockResolvedValueOnce({ id: "type-3", name: "Type 3" });

            await GET();

            expect(prisma.itemType.findUnique).toHaveBeenCalledTimes(3);
        });
    });
});
