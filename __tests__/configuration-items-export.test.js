import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
    default: {
        configurationItem: { findMany: vi.fn() },
        apiToken: { findUnique: vi.fn() },
    },
}));
vi.mock("next-auth/next", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/authOptions", () => ({ default: {} }));

import { GET } from "../app/api/configuration-items/export/route.ts";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth/next";

function request(qs) {
    return {
        url: `http://localhost:3000/api/configuration-items/export${qs}`,
        headers: { get: vi.fn(() => null) },
    };
}

async function exportWhere(qs) {
    const res = await GET(request(qs));
    expect(res.status).toBe(200);
    return prisma.configurationItem.findMany.mock.calls[0][0].where;
}

describe("GET /api/configuration-items/export filters", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getServerSession.mockResolvedValue({ user: { id: "user-1", role: "USER" } });
        prisma.configurationItem.findMany.mockResolvedValue([]);
    });

    it("returns 401 without authentication", async () => {
        getServerSession.mockResolvedValue(null);
        prisma.apiToken.findUnique.mockResolvedValue(null);
        const res = await GET(request(""));
        expect(res.status).toBe(401);
        expect(prisma.configurationItem.findMany).not.toHaveBeenCalled();
    });

    it("exports everything without filters", async () => {
        expect(await exportWhere("")).toEqual({});
    });

    it("filters by tagId like the list endpoint", async () => {
        expect(await exportWhere("?tagId=t1")).toEqual({ tags: { some: { id: "t1" } } });
    });

    it("searches name, description, IP and MAC like the list endpoint", async () => {
        expect(await exportWhere("?search=web")).toEqual({
            OR: [
                { name: { contains: "web", mode: "insensitive" } },
                { description: { contains: "web", mode: "insensitive" } },
                { ip: { contains: "web", mode: "insensitive" } },
                { mac: { contains: "web", mode: "insensitive" } },
            ],
        });
    });

    it("combines search, type, status and tag", async () => {
        const where = await exportWhere("?search=db&typeId=ty1&status=ACTIVE&tagId=t2&format=csv");
        expect(where.itemTypeId).toBe("ty1");
        expect(where.status).toBe("ACTIVE");
        expect(where.tags).toEqual({ some: { id: "t2" } });
        expect(where.OR).toHaveLength(4);
    });
});
