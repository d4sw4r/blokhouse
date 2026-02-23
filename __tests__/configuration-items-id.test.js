import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock prisma before importing the route
vi.mock("@/lib/prisma", () => ({
    default: {
        configurationItem: {
            findUnique: vi.fn(),
            update: vi.fn(),
            delete: vi.fn(),
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

import { GET, PUT, DELETE } from "../app/api/configuration-items/[id]/route.js";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { logItemUpdated, logItemDeleted } from "@/lib/audit";

describe("Configuration Items Single Item API", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    // Helper to create mock request
    function createMockRequest(options = {}) {
        return {
            json: vi.fn().mockResolvedValue(options.body || {}),
        };
    }

    // Helper for params
    function createParams(id) {
        return Promise.resolve({ id });
    }

    describe("GET /api/configuration-items/[id]", () => {
        it("returns 401 when not authenticated", async () => {
            getServerSession.mockResolvedValue(null);
            const request = createMockRequest();
            const params = createParams("item-1");

            const response = await GET(request, { params });
            const data = await response.json();

            expect(response.status).toBe(401);
            expect(data.error).toBe("Unauthorized");
        });

        it("returns 404 when item does not exist", async () => {
            getServerSession.mockResolvedValue({
                user: { id: "user-1", role: "USER" },
            });
            prisma.configurationItem.findUnique.mockResolvedValue(null);

            const request = createMockRequest();
            const params = createParams("nonexistent-id");

            const response = await GET(request, { params });
            const data = await response.json();

            expect(response.status).toBe(404);
            expect(data.error).toBe("Not found");
        });

        it("returns item with custom fields formatted", async () => {
            getServerSession.mockResolvedValue({
                user: { id: "user-1", role: "USER" },
            });

            const mockItem = {
                id: "item-1",
                name: "Server 01",
                description: "Test server",
                ip: "192.168.1.1",
                mac: "00:11:22:33:44:55",
                status: "ACTIVE",
                itemType: { id: "type-1", name: "Server" },
                tags: [{ id: "tag-1", name: "production" }],
                customFieldValues: [
                    {
                        customField: {
                            id: "cf-1",
                            name: "purchase_date",
                            label: "Purchase Date",
                            type: "DATE",
                        },
                        value: "2024-01-15",
                    },
                    {
                        customField: {
                            id: "cf-2",
                            name: "cost",
                            label: "Cost",
                            type: "NUMBER",
                        },
                        value: "1000.00",
                    },
                ],
            };

            prisma.configurationItem.findUnique.mockResolvedValue(mockItem);

            const request = createMockRequest();
            const params = createParams("item-1");

            const response = await GET(request, { params });
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.id).toBe("item-1");
            expect(data.name).toBe("Server 01");
            expect(data.customFields).toHaveLength(2);
            expect(data.customFields[0]).toEqual({
                id: "cf-1",
                name: "purchase_date",
                label: "Purchase Date",
                type: "DATE",
                value: "2024-01-15",
            });
            expect(data.customFieldValues).toBeUndefined();
        });

        it("returns item without custom fields when none exist", async () => {
            getServerSession.mockResolvedValue({
                user: { id: "user-1", role: "USER" },
            });

            const mockItem = {
                id: "item-1",
                name: "Simple Server",
                description: null,
                ip: null,
                mac: null,
                status: "ACTIVE",
                itemType: null,
                tags: [],
                customFieldValues: [],
            };

            prisma.configurationItem.findUnique.mockResolvedValue(mockItem);

            const request = createMockRequest();
            const params = createParams("item-1");

            const response = await GET(request, { params });
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.customFields).toEqual([]);
            expect(data.customFieldValues).toBeUndefined();
        });

        it("includes related item type and tags", async () => {
            getServerSession.mockResolvedValue({
                user: { id: "user-1", role: "USER" },
            });

            const mockItem = {
                id: "item-1",
                name: "Web Server",
                itemType: { id: "type-web", name: "Web Server", description: "Web servers" },
                tags: [
                    { id: "tag-1", name: "production", color: "#ff0000" },
                    { id: "tag-2", name: "critical", color: "#ff8800" },
                ],
                customFieldValues: [],
            };

            prisma.configurationItem.findUnique.mockResolvedValue(mockItem);

            const request = createMockRequest();
            const params = createParams("item-1");

            const response = await GET(request, { params });
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.itemType.name).toBe("Web Server");
            expect(data.tags).toHaveLength(2);
            expect(data.tags[0].name).toBe("production");
        });

        it("queries with correct include options", async () => {
            getServerSession.mockResolvedValue({
                user: { id: "user-1", role: "USER" },
            });

            prisma.configurationItem.findUnique.mockResolvedValue({
                id: "item-1",
                name: "Test",
                customFieldValues: [],
            });

            const request = createMockRequest();
            const params = createParams("item-1");

            await GET(request, { params });

            expect(prisma.configurationItem.findUnique).toHaveBeenCalledWith({
                where: { id: "item-1" },
                include: {
                    itemType: true,
                    tags: true,
                    customFieldValues: {
                        include: { customField: true },
                    },
                },
            });
        });
    });

    describe("PUT /api/configuration-items/[id]", () => {
        it("returns 401 when not authenticated", async () => {
            getServerSession.mockResolvedValue(null);
            const request = createMockRequest({ body: { name: "Updated" } });
            const params = createParams("item-1");

            const response = await PUT(request, { params });
            const data = await response.json();

            expect(response.status).toBe(401);
            expect(data.error).toBe("Unauthorized");
        });

        it("returns 404 when item does not exist", async () => {
            getServerSession.mockResolvedValue({
                user: { id: "user-1", role: "USER" },
            });
            prisma.configurationItem.findUnique.mockResolvedValue(null);

            const request = createMockRequest({ body: { name: "Updated" } });
            const params = createParams("nonexistent-id");

            const response = await PUT(request, { params });
            const data = await response.json();

            expect(response.status).toBe(404);
            expect(data.error).toBe("Not found");
        });

        it("updates item with all provided fields", async () => {
            getServerSession.mockResolvedValue({
                user: { id: "user-1", role: "USER" },
            });

            const oldItem = {
                id: "item-1",
                name: "Old Name",
                description: "Old description",
                itemType: null,
                tags: [],
            };

            const updatedItem = {
                id: "item-1",
                name: "New Name",
                description: "New description",
                ip: "192.168.1.100",
                mac: "00:11:22:33:44:55",
                status: "MAINTENANCE",
                itemTypeId: "type-2",
                itemType: { id: "type-2", name: "Database" },
                tags: [],
            };

            prisma.configurationItem.findUnique.mockResolvedValue(oldItem);
            prisma.configurationItem.update.mockResolvedValue(updatedItem);

            const request = createMockRequest({
                body: {
                    name: "New Name",
                    description: "New description",
                    ip: "192.168.1.100",
                    mac: "00:11:22:33:44:55",
                    status: "MAINTENANCE",
                    itemTypeId: "type-2",
                },
            });
            const params = createParams("item-1");

            const response = await PUT(request, { params });
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.name).toBe("New Name");
            expect(data.description).toBe("New description");
            expect(data.ip).toBe("192.168.1.100");
            expect(data.status).toBe("MAINTENANCE");
        });

        it("updates item tags when tagIds provided", async () => {
            getServerSession.mockResolvedValue({
                user: { id: "user-1", role: "USER" },
            });

            const oldItem = {
                id: "item-1",
                name: "Server",
                itemType: null,
                tags: [{ id: "old-tag", name: "old" }],
            };

            const updatedItem = {
                id: "item-1",
                name: "Server",
                itemType: null,
                tags: [
                    { id: "tag-1", name: "production" },
                    { id: "tag-2", name: "critical" },
                ],
            };

            prisma.configurationItem.findUnique.mockResolvedValue(oldItem);
            prisma.configurationItem.update.mockResolvedValue(updatedItem);

            const request = createMockRequest({
                body: {
                    tagIds: ["tag-1", "tag-2"],
                },
            });
            const params = createParams("item-1");

            const response = await PUT(request, { params });

            expect(response.status).toBe(200);
            expect(prisma.configurationItem.update).toHaveBeenCalledWith({
                where: { id: "item-1" },
                data: {
                    name: undefined,
                    description: undefined,
                    ip: undefined,
                    mac: undefined,
                    itemTypeId: undefined,
                    status: undefined,
                    tags: {
                        set: [{ id: "tag-1" }, { id: "tag-2" }],
                    },
                },
                include: { itemType: true, tags: true },
            });
        });

        it("clears all tags when empty tagIds array provided", async () => {
            getServerSession.mockResolvedValue({
                user: { id: "user-1", role: "USER" },
            });

            const oldItem = {
                id: "item-1",
                name: "Server",
                itemType: null,
                tags: [{ id: "tag-1", name: "production" }],
            };

            const updatedItem = {
                id: "item-1",
                name: "Server",
                itemType: null,
                tags: [],
            };

            prisma.configurationItem.findUnique.mockResolvedValue(oldItem);
            prisma.configurationItem.update.mockResolvedValue(updatedItem);

            const request = createMockRequest({
                body: { tagIds: [] },
            });
            const params = createParams("item-1");

            await PUT(request, { params });

            expect(prisma.configurationItem.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        tags: { set: [] },
                    }),
                })
            );
        });

        it("does not modify tags when tagIds is undefined", async () => {
            getServerSession.mockResolvedValue({
                user: { id: "user-1", role: "USER" },
            });

            const oldItem = {
                id: "item-1",
                name: "Server",
                itemType: null,
                tags: [{ id: "tag-1", name: "production" }],
            };

            prisma.configurationItem.findUnique.mockResolvedValue(oldItem);
            prisma.configurationItem.update.mockResolvedValue(oldItem);

            const request = createMockRequest({
                body: { name: "Updated Server" },
            });
            const params = createParams("item-1");

            await PUT(request, { params });

            expect(prisma.configurationItem.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.not.objectContaining({
                        tags: expect.anything(),
                    }),
                })
            );
        });

        it("logs the update via audit", async () => {
            getServerSession.mockResolvedValue({
                user: { id: "user-1", role: "USER" },
            });

            const oldItem = {
                id: "item-1",
                name: "Old Name",
                itemType: null,
                tags: [],
            };

            const updatedItem = {
                id: "item-1",
                name: "New Name",
                itemType: null,
                tags: [],
            };

            prisma.configurationItem.findUnique.mockResolvedValue(oldItem);
            prisma.configurationItem.update.mockResolvedValue(updatedItem);

            const request = createMockRequest({
                body: { name: "New Name" },
            });
            const params = createParams("item-1");

            await PUT(request, { params });

            expect(logItemUpdated).toHaveBeenCalledWith({
                oldItem,
                newItem: updatedItem,
                userId: "user-1",
                req: request,
            });
        });

        it("handles partial updates correctly", async () => {
            getServerSession.mockResolvedValue({
                user: { id: "user-1", role: "USER" },
            });

            const oldItem = {
                id: "item-1",
                name: "Server",
                description: "Original description",
                ip: "10.0.0.1",
                mac: "00:11:22:33:44:55",
                status: "ACTIVE",
                itemType: null,
                tags: [],
            };

            const updatedItem = {
                id: "item-1",
                name: "Server",
                description: "Original description",
                ip: "10.0.0.1",
                mac: "00:11:22:33:44:55",
                status: "DEPRECATED",
                itemType: null,
                tags: [],
            };

            prisma.configurationItem.findUnique.mockResolvedValue(oldItem);
            prisma.configurationItem.update.mockResolvedValue(updatedItem);

            const request = createMockRequest({
                body: { status: "DEPRECATED" },
            });
            const params = createParams("item-1");

            const response = await PUT(request, { params });
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.status).toBe("DEPRECATED");
        });
    });

    describe("DELETE /api/configuration-items/[id]", () => {
        it("returns 401 when not authenticated", async () => {
            getServerSession.mockResolvedValue(null);
            const request = createMockRequest();
            const params = createParams("item-1");

            const response = await DELETE(request, { params });
            const data = await response.json();

            expect(response.status).toBe(401);
            expect(data.error).toBe("Unauthorized");
        });

        it("returns 404 when item does not exist", async () => {
            getServerSession.mockResolvedValue({
                user: { id: "user-1", role: "USER" },
            });
            prisma.configurationItem.findUnique.mockResolvedValue(null);

            const request = createMockRequest();
            const params = createParams("nonexistent-id");

            const response = await DELETE(request, { params });
            const data = await response.json();

            expect(response.status).toBe(404);
            expect(data.error).toBe("Not found");
        });

        it("deletes item and returns success message", async () => {
            getServerSession.mockResolvedValue({
                user: { id: "user-1", role: "USER" },
            });

            const itemToDelete = {
                id: "item-1",
                name: "Server to Delete",
                description: "Will be deleted",
                itemType: { id: "type-1", name: "Server" },
                tags: [{ id: "tag-1", name: "temporary" }],
            };

            prisma.configurationItem.findUnique.mockResolvedValue(itemToDelete);
            prisma.configurationItem.delete.mockResolvedValue(itemToDelete);

            const request = createMockRequest();
            const params = createParams("item-1");

            const response = await DELETE(request, { params });
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.message).toBe("Deleted");
            expect(prisma.configurationItem.delete).toHaveBeenCalledWith({
                where: { id: "item-1" },
            });
        });

        it("logs the deletion via audit", async () => {
            getServerSession.mockResolvedValue({
                user: { id: "user-1", role: "USER" },
            });

            const itemToDelete = {
                id: "item-1",
                name: "Server to Delete",
                itemType: null,
                tags: [],
            };

            prisma.configurationItem.findUnique.mockResolvedValue(itemToDelete);
            prisma.configurationItem.delete.mockResolvedValue(itemToDelete);

            const request = createMockRequest();
            const params = createParams("item-1");

            await DELETE(request, { params });

            expect(logItemDeleted).toHaveBeenCalledWith({
                item: itemToDelete,
                userId: "user-1",
                req: request,
            });
        });

        it("fetches item with includes before deleting for audit", async () => {
            getServerSession.mockResolvedValue({
                user: { id: "user-1", role: "USER" },
            });

            const itemToDelete = {
                id: "item-1",
                name: "Server",
                itemType: { id: "type-1", name: "Server" },
                tags: [{ id: "tag-1", name: "production" }],
            };

            prisma.configurationItem.findUnique.mockResolvedValue(itemToDelete);
            prisma.configurationItem.delete.mockResolvedValue(itemToDelete);

            const request = createMockRequest();
            const params = createParams("item-1");

            await DELETE(request, { params });

            expect(prisma.configurationItem.findUnique).toHaveBeenCalledWith({
                where: { id: "item-1" },
                include: { itemType: true, tags: true },
            });
        });

        it("handles database error during deletion", async () => {
            getServerSession.mockResolvedValue({
                user: { id: "user-1", role: "USER" },
            });

            const itemToDelete = {
                id: "item-1",
                name: "Server",
                itemType: null,
                tags: [],
            };

            prisma.configurationItem.findUnique.mockResolvedValue(itemToDelete);
            prisma.configurationItem.delete.mockRejectedValue(new Error("DB Error"));

            const request = createMockRequest();
            const params = createParams("item-1");

            await expect(DELETE(request, { params })).rejects.toThrow("DB Error");
        });
    });
});
