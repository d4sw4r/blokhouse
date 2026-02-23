import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock prisma and next-auth before importing routes
vi.mock("@/lib/prisma", () => ({
    default: {
        configurationItem: {
            update: vi.fn(),
        },
    },
}));

vi.mock("next-auth/next", () => ({
    getServerSession: vi.fn(),
}));

vi.mock("@/lib/authOptions", () => ({
    default: {},
}));

import { POST, DELETE } from "../app/api/configuration-items/[id]/tags/route.js";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth/next";

describe("Configuration Item Tags API", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    function makeRequest(body = {}, itemId = "item-1") {
        return {
            url: `http://localhost:3000/api/configuration-items/${itemId}/tags`,
            headers: { get: vi.fn(() => null) },
            json: vi.fn().mockResolvedValue(body),
        };
    }

    function makeContext(id) {
        return { params: Promise.resolve({ id }) };
    }

    // ─── Authentication & Authorization ────────────────────────────────────────

    describe("authentication", () => {
        it("POST returns 401 when not authenticated", async () => {
            getServerSession.mockResolvedValue(null);

            const res = await POST(makeRequest({ tagIds: ["tag-1"] }), makeContext("item-1"));
            const data = await res.json();

            expect(res.status).toBe(401);
            expect(data.error).toBe("Unauthorized");
            expect(prisma.configurationItem.update).not.toHaveBeenCalled();
        });

        it("DELETE returns 401 when not authenticated", async () => {
            getServerSession.mockResolvedValue(null);

            const res = await DELETE(makeRequest({ tagIds: ["tag-1"] }), makeContext("item-1"));
            const data = await res.json();

            expect(res.status).toBe(401);
            expect(data.error).toBe("Unauthorized");
        });
    });

    describe("authorization", () => {
        it("POST returns 403 for READONLY users", async () => {
            getServerSession.mockResolvedValue({ user: { id: "u1", role: "READONLY" } });

            const res = await POST(makeRequest({ tagIds: ["tag-1"] }), makeContext("item-1"));
            const data = await res.json();

            expect(res.status).toBe(403);
            expect(data.error).toBe("Forbidden: Read-only access");
        });

        it("DELETE returns 403 for READONLY users", async () => {
            getServerSession.mockResolvedValue({ user: { id: "u1", role: "READONLY" } });

            const res = await DELETE(makeRequest({ tagIds: ["tag-1"] }), makeContext("item-1"));
            const data = await res.json();

            expect(res.status).toBe(403);
            expect(data.error).toBe("Forbidden: Read-only access");
        });

        it("allows ADMIN users", async () => {
            getServerSession.mockResolvedValue({ user: { id: "u1", role: "ADMIN" } });
            prisma.configurationItem.update.mockResolvedValue({ id: "item-1", name: "Server" });

            const res = await POST(makeRequest({ tagIds: ["tag-1"] }), makeContext("item-1"));
            expect(res.status).toBe(200);
        });

        it("allows USER role", async () => {
            getServerSession.mockResolvedValue({ user: { id: "u1", role: "USER" } });
            prisma.configurationItem.update.mockResolvedValue({ id: "item-1", name: "Server" });

            const res = await POST(makeRequest({ tagIds: ["tag-1"] }), makeContext("item-1"));
            expect(res.status).toBe(200);
        });

        it("allows API role", async () => {
            getServerSession.mockResolvedValue({ user: { id: "u1", role: "API" } });
            prisma.configurationItem.update.mockResolvedValue({ id: "item-1", name: "Server" });

            const res = await POST(makeRequest({ tagIds: ["tag-1"] }), makeContext("item-1"));
            expect(res.status).toBe(200);
        });
    });

    // ─── POST / Add Tags ───────────────────────────────────────────────────────

    describe("POST / add tags", () => {
        beforeEach(() => {
            getServerSession.mockResolvedValue({ user: { id: "u1", role: "ADMIN" } });
        });

        it("adds tags to a configuration item", async () => {
            const mockItem = {
                id: "item-1",
                name: "Server",
                tags: [{ id: "tag-1", name: "Production" }, { id: "tag-2", name: "Critical" }],
            };
            prisma.configurationItem.update.mockResolvedValue(mockItem);

            const body = { tagIds: ["tag-1", "tag-2"] };
            const res = await POST(makeRequest(body), makeContext("item-1"));
            const data = await res.json();

            expect(res.status).toBe(200);
            expect(data.tags).toHaveLength(2);
        });

        it("connects tags using Prisma connect", async () => {
            prisma.configurationItem.update.mockResolvedValue({ id: "item-1", name: "Server" });

            const body = { tagIds: ["tag-1", "tag-2"] };
            await POST(makeRequest(body), makeContext("item-1"));

            expect(prisma.configurationItem.update).toHaveBeenCalledWith({
                where: { id: "item-1" },
                data: {
                    tags: {
                        connect: [{ id: "tag-1" }, { id: "tag-2" }],
                    },
                },
                include: { itemType: true, tags: true },
            });
        });

        it("returns 400 when tagIds is missing", async () => {
            const res = await POST(makeRequest({}), makeContext("item-1"));
            const data = await res.json();

            expect(res.status).toBe(400);
            expect(data.error).toBe("tagIds array is required");
        });

        it("returns 400 when tagIds is not an array", async () => {
            const res = await POST(makeRequest({ tagIds: "tag-1" }), makeContext("item-1"));
            const data = await res.json();

            expect(res.status).toBe(400);
            expect(data.error).toBe("tagIds array is required");
        });

        it("returns 400 when tagIds is empty array", async () => {
            const res = await POST(makeRequest({ tagIds: [] }), makeContext("item-1"));
            const data = await res.json();

            expect(res.status).toBe(400);
            expect(data.error).toBe("tagIds array is required");
        });

        it("returns 404 when configuration item not found", async () => {
            prisma.configurationItem.update.mockRejectedValue({ code: "P2025" });

            const res = await POST(makeRequest({ tagIds: ["tag-1"] }), makeContext("nonexistent"));
            const data = await res.json();

            expect(res.status).toBe(404);
            expect(data.error).toBe("Configuration item not found");
        });

        it("returns 500 on unexpected database error", async () => {
            prisma.configurationItem.update.mockRejectedValue(new Error("DB error"));

            const res = await POST(makeRequest({ tagIds: ["tag-1"] }), makeContext("item-1"));
            const data = await res.json();

            expect(res.status).toBe(500);
            expect(data.error).toBe("Failed to add tags");
        });

        it("includes itemType in response", async () => {
            prisma.configurationItem.update.mockResolvedValue({
                id: "item-1",
                name: "Server",
                itemType: { id: "type-1", name: "Server" },
                tags: [{ id: "tag-1", name: "Production" }],
            });

            const res = await POST(makeRequest({ tagIds: ["tag-1"] }), makeContext("item-1"));
            const data = await res.json();

            expect(data.itemType).toBeDefined();
            expect(data.itemType.name).toBe("Server");
        });
    });

    // ─── DELETE / Remove Tags ──────────────────────────────────────────────────

    describe("DELETE / remove tags", () => {
        beforeEach(() => {
            getServerSession.mockResolvedValue({ user: { id: "u1", role: "ADMIN" } });
        });

        it("removes tags from a configuration item", async () => {
            const mockItem = {
                id: "item-1",
                name: "Server",
                tags: [{ id: "tag-3", name: "Remaining" }],
            };
            prisma.configurationItem.update.mockResolvedValue(mockItem);

            const body = { tagIds: ["tag-1", "tag-2"] };
            const res = await DELETE(makeRequest(body), makeContext("item-1"));
            const data = await res.json();

            expect(res.status).toBe(200);
            expect(data.tags).toHaveLength(1);
        });

        it("disconnects tags using Prisma disconnect", async () => {
            prisma.configurationItem.update.mockResolvedValue({ id: "item-1", name: "Server" });

            const body = { tagIds: ["tag-1", "tag-2"] };
            await DELETE(makeRequest(body), makeContext("item-1"));

            expect(prisma.configurationItem.update).toHaveBeenCalledWith({
                where: { id: "item-1" },
                data: {
                    tags: {
                        disconnect: [{ id: "tag-1" }, { id: "tag-2" }],
                    },
                },
                include: { itemType: true, tags: true },
            });
        });

        it("returns 400 when tagIds is missing", async () => {
            const res = await DELETE(makeRequest({}), makeContext("item-1"));
            const data = await res.json();

            expect(res.status).toBe(400);
            expect(data.error).toBe("tagIds array is required");
        });

        it("returns 400 when tagIds is not an array", async () => {
            const res = await DELETE(makeRequest({ tagIds: "tag-1" }), makeContext("item-1"));
            const data = await res.json();

            expect(res.status).toBe(400);
            expect(data.error).toBe("tagIds array is required");
        });

        it("returns 400 when tagIds is empty array", async () => {
            const res = await DELETE(makeRequest({ tagIds: [] }), makeContext("item-1"));
            const data = await res.json();

            expect(res.status).toBe(400);
            expect(data.error).toBe("tagIds array is required");
        });

        it("returns 404 when configuration item not found", async () => {
            prisma.configurationItem.update.mockRejectedValue({ code: "P2025" });

            const res = await DELETE(makeRequest({ tagIds: ["tag-1"] }), makeContext("nonexistent"));
            const data = await res.json();

            expect(res.status).toBe(404);
            expect(data.error).toBe("Configuration item not found");
        });

        it("returns 500 on unexpected database error", async () => {
            prisma.configurationItem.update.mockRejectedValue(new Error("DB error"));

            const res = await DELETE(makeRequest({ tagIds: ["tag-1"] }), makeContext("item-1"));
            const data = await res.json();

            expect(res.status).toBe(500);
            expect(data.error).toBe("Failed to remove tags");
        });
    });

    // ─── Edge Cases ────────────────────────────────────────────────────────────

    describe("edge cases", () => {
        beforeEach(() => {
            getServerSession.mockResolvedValue({ user: { id: "u1", role: "ADMIN" } });
        });

        it("handles many tag IDs at once", async () => {
            prisma.configurationItem.update.mockResolvedValue({ id: "item-1", name: "Server" });

            const tagIds = Array.from({ length: 50 }, (_, i) => `tag-${i}`);
            const res = await POST(makeRequest({ tagIds }), makeContext("item-1"));

            expect(res.status).toBe(200);
            expect(prisma.configurationItem.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        tags: expect.objectContaining({
                            connect: tagIds.map(id => ({ id })),
                        }),
                    }),
                })
            );
        });

        it("handles special characters in item ID", async () => {
            prisma.configurationItem.update.mockResolvedValue({ id: "item-special", name: "Server" });

            const res = await POST(makeRequest({ tagIds: ["tag-1"] }), makeContext("item-special_123"));
            expect(res.status).toBe(200);
        });

        // Note: request.json() errors are not caught by the route's try-catch
        // This would be a potential improvement for the route
    });
});
