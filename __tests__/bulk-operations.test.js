import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock prisma before importing the route
vi.mock("@/lib/prisma", () => ({
    default: {
        configurationItem: {
            findMany: vi.fn(),
            delete: vi.fn(),
            update: vi.fn(),
            findUnique: vi.fn(),
        },
        apiToken: {
            findUnique: vi.fn(),
        },
    },
}));

// Mock next-auth
vi.mock("next-auth/next", () => ({
    getServerSession: vi.fn(),
}));

// Mock audit logging
vi.mock("@/lib/audit", () => ({
    logItemUpdated: vi.fn(),
    logItemDeleted: vi.fn(),
}));

// Mock authOptions
vi.mock("@/lib/authOptions", () => ({
    default: {},
}));

import { GET, POST } from "../app/api/configuration-items/bulk/route.js";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { logItemUpdated, logItemDeleted } from "@/lib/audit";

describe("Bulk Operations API", () => {
    let request;

    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    // Helper to create mock request
    function createMockRequest(body = {}, options = {}) {
        return {
            url: "http://localhost:3000/api/configuration-items/bulk",
            headers: {
                get: vi.fn((header) => {
                    if (header === "authorization") return options.authHeader || null;
                    if (header === "user-agent") return "test-agent";
                    if (header === "x-forwarded-for") return "127.0.0.1";
                    return null;
                }),
            },
            json: vi.fn().mockResolvedValue(body),
        };
    }

    describe("GET /api/configuration-items/bulk", () => {
        it("returns available bulk operations", async () => {
            const response = await GET();
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.operations).toHaveLength(5);
            expect(data.operations.map(op => op.name)).toContain("delete");
            expect(data.operations.map(op => op.name)).toContain("updateStatus");
            expect(data.operations.map(op => op.name)).toContain("addTags");
            expect(data.operations.map(op => op.name)).toContain("removeTags");
            expect(data.operations.map(op => op.name)).toContain("setTags");
        });

        it("includes required parameters for each operation", async () => {
            const response = await GET();
            const data = await response.json();

            const deleteOp = data.operations.find(op => op.name === "delete");
            expect(deleteOp.requiredParams).toEqual(["ids"]);

            const statusOp = data.operations.find(op => op.name === "updateStatus");
            expect(statusOp.requiredParams).toEqual(["ids", "status"]);
            expect(statusOp.validStatusValues).toEqual(["ACTIVE", "DEPRECATED", "MAINTENANCE"]);
        });
    });

    describe("POST /api/configuration-items/bulk - Authentication", () => {
        it("returns 401 when no authentication provided", async () => {
            request = createMockRequest({ operation: "delete", ids: ["item-1"] });
            getServerSession.mockResolvedValue(null);
            prisma.apiToken.findUnique.mockResolvedValue(null);

            const response = await POST(request);
            const data = await response.json();

            expect(response.status).toBe(401);
            expect(data.error).toBe("Unauthorized");
        });

        it("returns 403 for read-only users", async () => {
            request = createMockRequest({ operation: "delete", ids: ["item-1"] });
            getServerSession.mockResolvedValue({
                user: { id: "user-1", role: "READONLY" },
            });

            const response = await POST(request);
            const data = await response.json();

            expect(response.status).toBe(403);
            expect(data.error).toBe("Forbidden: Read-only access");
        });

        it("authenticates with valid API token", async () => {
            request = createMockRequest(
                { operation: "updateStatus", ids: ["item-1"], status: "MAINTENANCE" },
                { authHeader: "Bearer valid-token" }
            );

            prisma.apiToken.findUnique.mockResolvedValue({
                token: "valid-token",
                user: { id: "user-1", role: "API" },
            });

            prisma.configurationItem.findMany.mockResolvedValue([
                { id: "item-1", name: "Server 1" },
            ]);

            prisma.configurationItem.findUnique.mockResolvedValue({
                id: "item-1",
                name: "Server 1",
                status: "ACTIVE",
            });

            prisma.configurationItem.update.mockResolvedValue({
                id: "item-1",
                name: "Server 1",
                status: "MAINTENANCE",
            });

            const response = await POST(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.success).toBe(true);
        });

        it("allows ADMIN role", async () => {
            request = createMockRequest({ operation: "delete", ids: ["item-1"] });
            getServerSession.mockResolvedValue({
                user: { id: "user-1", role: "ADMIN" },
            });

            prisma.configurationItem.findMany.mockResolvedValue([]);

            const response = await POST(request);
            expect(response.status).toBe(404); // Not found, but authorized
        });

        it("allows USER role", async () => {
            request = createMockRequest({ operation: "delete", ids: ["item-1"] });
            getServerSession.mockResolvedValue({
                user: { id: "user-1", role: "USER" },
            });

            prisma.configurationItem.findMany.mockResolvedValue([]);

            const response = await POST(request);
            expect(response.status).toBe(404);
        });

        it("allows API role", async () => {
            request = createMockRequest({ operation: "delete", ids: ["item-1"] }, { authHeader: "Bearer token" });
            prisma.apiToken.findUnique.mockResolvedValue({
                token: "token",
                user: { id: "user-1", role: "API" },
            });
            prisma.configurationItem.findMany.mockResolvedValue([]);

            const response = await POST(request);
            expect(response.status).toBe(404);
        });
    });

    describe("POST /api/configuration-items/bulk - Validation", () => {
        beforeEach(() => {
            getServerSession.mockResolvedValue({
                user: { id: "user-1", role: "ADMIN" },
            });
        });

        it("returns 400 when operation is missing", async () => {
            request = createMockRequest({ ids: ["item-1"] });

            const response = await POST(request);
            const data = await response.json();

            expect(response.status).toBe(400);
            expect(data.error).toContain("Missing required fields");
        });

        it("returns 400 when ids is missing", async () => {
            request = createMockRequest({ operation: "delete" });

            const response = await POST(request);
            const data = await response.json();

            expect(response.status).toBe(400);
            expect(data.error).toContain("Missing required fields");
        });

        it("returns 400 when ids is empty array", async () => {
            request = createMockRequest({ operation: "delete", ids: [] });

            const response = await POST(request);
            const data = await response.json();

            expect(response.status).toBe(400);
            expect(data.error).toContain("Missing required fields");
        });

        it("returns 400 for invalid operation", async () => {
            request = createMockRequest({ operation: "invalidOp", ids: ["item-1"] });

            const response = await POST(request);
            const data = await response.json();

            expect(response.status).toBe(400);
            expect(data.error).toContain("Invalid operation");
        });

        it("returns 400 for updateStatus without status", async () => {
            request = createMockRequest({ operation: "updateStatus", ids: ["item-1"] });

            const response = await POST(request);
            const data = await response.json();

            expect(response.status).toBe(400);
            expect(data.error).toContain("Missing required field: status");
        });

        it("returns 400 for tag operations without tagIds", async () => {
            request = createMockRequest({ operation: "addTags", ids: ["item-1"] });

            const response = await POST(request);
            const data = await response.json();

            expect(response.status).toBe(400);
            expect(data.error).toContain("Missing required field: tagIds");
        });

        it("returns 400 for invalid status value", async () => {
            request = createMockRequest({
                operation: "updateStatus",
                ids: ["item-1"],
                status: "INVALID",
            });

            prisma.configurationItem.findMany.mockResolvedValue([
                { id: "item-1", name: "Server 1" },
            ]);

            const response = await POST(request);
            const data = await response.json();

            expect(response.status).toBe(400);
            expect(data.error).toContain("Invalid status");
        });

        it("returns 404 when no items found for provided IDs", async () => {
            request = createMockRequest({ operation: "delete", ids: ["nonexistent"] });
            prisma.configurationItem.findMany.mockResolvedValue([]);

            const response = await POST(request);
            const data = await response.json();

            expect(response.status).toBe(404);
            expect(data.error).toContain("No valid configuration items found");
        });
    });

    describe("POST /api/configuration-items/bulk - Delete Operation", () => {
        beforeEach(() => {
            getServerSession.mockResolvedValue({
                user: { id: "user-1", role: "ADMIN" },
            });
        });

        it("deletes multiple items successfully", async () => {
            request = createMockRequest({ operation: "delete", ids: ["item-1", "item-2"] });

            prisma.configurationItem.findMany.mockResolvedValue([
                { id: "item-1", name: "Server 1" },
                { id: "item-2", name: "Server 2" },
            ]);

            prisma.configurationItem.delete.mockResolvedValue({});

            const response = await POST(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.success).toBe(true);
            expect(data.operation).toBe("delete");
            expect(data.processed).toBe(2);
            expect(data.failed).toBe(0);
            expect(prisma.configurationItem.delete).toHaveBeenCalledTimes(2);
            expect(logItemDeleted).toHaveBeenCalledTimes(2);
        });

        it("handles partial failures during delete", async () => {
            request = createMockRequest({ operation: "delete", ids: ["item-1", "item-2"] });

            prisma.configurationItem.findMany.mockResolvedValue([
                { id: "item-1", name: "Server 1" },
                { id: "item-2", name: "Server 2" },
            ]);

            prisma.configurationItem.delete
                .mockResolvedValueOnce({})
                .mockRejectedValueOnce(new Error("Database error"));

            const response = await POST(request);
            const data = await response.json();

            expect(response.status).toBe(207); // Multi-Status
            expect(data.success).toBe(false);
            expect(data.processed).toBe(1);
            expect(data.failed).toBe(1);
            expect(data.errors).toHaveLength(1);
            expect(data.errors[0].id).toBe("item-2");
        });

        it("reports not found IDs separately", async () => {
            request = createMockRequest({ operation: "delete", ids: ["item-1", "item-2", "item-3"] });

            prisma.configurationItem.findMany.mockResolvedValue([
                { id: "item-1", name: "Server 1" },
            ]);

            prisma.configurationItem.delete.mockResolvedValue({});

            const response = await POST(request);
            const data = await response.json();

            expect(data.totalRequested).toBe(3);
            expect(data.notFound).toEqual(["item-2", "item-3"]);
            expect(data.processed).toBe(1);
        });
    });

    describe("POST /api/configuration-items/bulk - Update Status Operation", () => {
        beforeEach(() => {
            getServerSession.mockResolvedValue({
                user: { id: "user-1", role: "ADMIN" },
            });
        });

        it("updates status for multiple items", async () => {
            request = createMockRequest({
                operation: "updateStatus",
                ids: ["item-1", "item-2"],
                status: "MAINTENANCE",
            });

            prisma.configurationItem.findMany.mockResolvedValue([
                { id: "item-1", name: "Server 1" },
                { id: "item-2", name: "Server 2" },
            ]);

            prisma.configurationItem.findUnique
                .mockResolvedValueOnce({ id: "item-1", name: "Server 1", status: "ACTIVE" })
                .mockResolvedValueOnce({ id: "item-2", name: "Server 2", status: "ACTIVE" });

            prisma.configurationItem.update
                .mockResolvedValueOnce({ id: "item-1", name: "Server 1", status: "MAINTENANCE" })
                .mockResolvedValueOnce({ id: "item-2", name: "Server 2", status: "MAINTENANCE" });

            const response = await POST(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.success).toBe(true);
            expect(data.processed).toBe(2);
            expect(prisma.configurationItem.update).toHaveBeenCalledTimes(2);
            expect(logItemUpdated).toHaveBeenCalledTimes(2);
        });

        it("accepts all valid status values", async () => {
            const validStatuses = ["ACTIVE", "DEPRECATED", "MAINTENANCE"];

            for (const status of validStatuses) {
                vi.clearAllMocks();
                getServerSession.mockResolvedValue({
                    user: { id: "user-1", role: "ADMIN" },
                });

                request = createMockRequest({
                    operation: "updateStatus",
                    ids: ["item-1"],
                    status,
                });

                prisma.configurationItem.findMany.mockResolvedValue([
                    { id: "item-1", name: "Server 1" },
                ]);

                prisma.configurationItem.findUnique.mockResolvedValue({
                    id: "item-1",
                    name: "Server 1",
                    status: "ACTIVE",
                });

                prisma.configurationItem.update.mockResolvedValue({
                    id: "item-1",
                    name: "Server 1",
                    status,
                });

                const response = await POST(request);
                expect(response.status).toBe(200);
            }
        });

        it("logs each status update with old and new values", async () => {
            request = createMockRequest({
                operation: "updateStatus",
                ids: ["item-1"],
                status: "DEPRECATED",
            });

            const oldItem = { id: "item-1", name: "Server 1", status: "ACTIVE" };
            const newItem = { id: "item-1", name: "Server 1", status: "DEPRECATED" };

            prisma.configurationItem.findMany.mockResolvedValue([
                { id: "item-1", name: "Server 1" },
            ]);

            prisma.configurationItem.findUnique.mockResolvedValue(oldItem);
            prisma.configurationItem.update.mockResolvedValue(newItem);

            await POST(request);

            expect(logItemUpdated).toHaveBeenCalledWith(expect.objectContaining({
                oldItem,
                newItem,
                userId: "user-1",
                changes: { status: { old: "ACTIVE", new: "DEPRECATED" } },
            }));
        });
    });

    describe("POST /api/configuration-items/bulk - Tag Operations", () => {
        beforeEach(() => {
            getServerSession.mockResolvedValue({
                user: { id: "user-1", role: "ADMIN" },
            });
        });

        it("adds tags to multiple items", async () => {
            request = createMockRequest({
                operation: "addTags",
                ids: ["item-1", "item-2"],
                tagIds: ["tag-1", "tag-2"],
            });

            prisma.configurationItem.findMany.mockResolvedValue([
                { id: "item-1", name: "Server 1" },
                { id: "item-2", name: "Server 2" },
            ]);

            prisma.configurationItem.update.mockResolvedValue({});

            const response = await POST(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.success).toBe(true);
            expect(data.processed).toBe(2);
            expect(prisma.configurationItem.update).toHaveBeenCalledTimes(2);

            // Check that tags were connected
            expect(prisma.configurationItem.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        tags: {
                            connect: [{ id: "tag-1" }, { id: "tag-2" }],
                        },
                    }),
                })
            );
        });

        it("removes tags from multiple items", async () => {
            request = createMockRequest({
                operation: "removeTags",
                ids: ["item-1", "item-2"],
                tagIds: ["tag-1", "tag-2"],
            });

            prisma.configurationItem.findMany.mockResolvedValue([
                { id: "item-1", name: "Server 1" },
                { id: "item-2", name: "Server 2" },
            ]);

            prisma.configurationItem.update.mockResolvedValue({});

            const response = await POST(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.processed).toBe(2);

            // Check that tags were disconnected
            expect(prisma.configurationItem.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        tags: {
                            disconnect: [{ id: "tag-1" }, { id: "tag-2" }],
                        },
                    }),
                })
            );
        });

        it("sets (replaces) tags for multiple items", async () => {
            request = createMockRequest({
                operation: "setTags",
                ids: ["item-1", "item-2"],
                tagIds: ["tag-3", "tag-4"],
            });

            prisma.configurationItem.findMany.mockResolvedValue([
                { id: "item-1", name: "Server 1" },
                { id: "item-2", name: "Server 2" },
            ]);

            prisma.configurationItem.update.mockResolvedValue({});

            const response = await POST(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.processed).toBe(2);

            // Check that tags were set (replaced)
            expect(prisma.configurationItem.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        tags: {
                            set: [{ id: "tag-3" }, { id: "tag-4" }],
                        },
                    }),
                })
            );
        });

        it("handles empty tagIds array for tag operations", async () => {
            request = createMockRequest({
                operation: "addTags",
                ids: ["item-1"],
                tagIds: [],
            });

            prisma.configurationItem.findMany.mockResolvedValue([
                { id: "item-1", name: "Server 1" },
            ]);

            prisma.configurationItem.update.mockResolvedValue({});

            const response = await POST(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.processed).toBe(1);
            expect(prisma.configurationItem.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        tags: {
                            connect: [],
                        },
                    }),
                })
            );
        });
    });

    describe("POST /api/configuration-items/bulk - Error Handling", () => {
        beforeEach(() => {
            getServerSession.mockResolvedValue({
                user: { id: "user-1", role: "ADMIN" },
            });
        });

        it("handles JSON parse errors", async () => {
            request = {
                headers: {
                    get: vi.fn().mockReturnValue(null),
                },
                json: vi.fn().mockRejectedValue(new Error("Invalid JSON")),
            };

            const response = await POST(request);
            const data = await response.json();

            expect(response.status).toBe(500);
            expect(data.error).toBe("Internal server error");
        });

        it("handles database errors gracefully", async () => {
            request = createMockRequest({ operation: "delete", ids: ["item-1"] });

            prisma.configurationItem.findMany.mockRejectedValue(new Error("Database connection failed"));

            const response = await POST(request);
            const data = await response.json();

            expect(response.status).toBe(500);
            expect(data.error).toBe("Internal server error");
        });

        it("continues processing on individual item errors", async () => {
            request = createMockRequest({
                operation: "addTags",
                ids: ["item-1", "item-2", "item-3"],
                tagIds: ["tag-1"],
            });

            prisma.configurationItem.findMany.mockResolvedValue([
                { id: "item-1", name: "Server 1" },
                { id: "item-2", name: "Server 2" },
                { id: "item-3", name: "Server 3" },
            ]);

            prisma.configurationItem.update
                .mockResolvedValueOnce({})
                .mockRejectedValueOnce(new Error("Item locked"))
                .mockResolvedValueOnce({});

            const response = await POST(request);
            const data = await response.json();

            expect(response.status).toBe(207);
            expect(data.processed).toBe(2);
            expect(data.failed).toBe(1);
            expect(data.errors).toHaveLength(1);
            expect(data.errors[0].id).toBe("item-2");
        });
    });
});
