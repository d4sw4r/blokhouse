import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock prisma before importing the route
vi.mock("@/lib/prisma", () => ({
    default: {
        configurationItem: {
            findMany: vi.fn(),
            count: vi.fn(),
            create: vi.fn(),
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
    logItemCreated: vi.fn(),
    logItemUpdated: vi.fn(),
}));

// Mock authOptions
vi.mock("@/lib/authOptions", () => ({
    default: {},
}));

import { GET, POST } from "../app/api/configuration-items/route.js";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { logItemCreated } from "@/lib/audit";

describe("Configuration Items API", () => {
    let request;

    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    // Helper to create mock request
    function createMockRequest(url, options = {}) {
        return {
            url,
            headers: {
                get: vi.fn((header) => {
                    if (header === "authorization") return options.authHeader || null;
                    return null;
                }),
            },
            json: vi.fn().mockResolvedValue(options.body || {}),
        };
    }

    describe("GET /api/configuration-items", () => {
        it("returns 401 when no authentication provided", async () => {
            request = createMockRequest("http://localhost:3000/api/configuration-items");
            getServerSession.mockResolvedValue(null);
            prisma.apiToken.findUnique.mockResolvedValue(null);

            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(401);
            expect(data.error).toBe("Unauthorized");
        });

        it("authenticates with valid API token", async () => {
            request = createMockRequest(
                "http://localhost:3000/api/configuration-items",
                { authHeader: "Bearer valid-token" }
            );

            prisma.apiToken.findUnique.mockResolvedValue({
                token: "valid-token",
                user: { id: "user-1", role: "API" },
            });

            prisma.configurationItem.count.mockResolvedValue(0);
            prisma.configurationItem.findMany.mockResolvedValue([]);

            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.items).toEqual([]);
            expect(data.pagination).toBeDefined();
        });

        it("authenticates with valid session", async () => {
            request = createMockRequest("http://localhost:3000/api/configuration-items");
            getServerSession.mockResolvedValue({
                user: { id: "user-1", role: "USER" },
            });

            prisma.configurationItem.count.mockResolvedValue(0);
            prisma.configurationItem.findMany.mockResolvedValue([]);

            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.items).toEqual([]);
        });

        it("returns paginated results with correct metadata", async () => {
            request = createMockRequest(
                "http://localhost:3000/api/configuration-items?page=2&limit=5"
            );
            getServerSession.mockResolvedValue({
                user: { id: "user-1", role: "USER" },
            });

            const mockItems = Array(5).fill(null).map((_, i) => ({
                id: `item-${i + 6}`,
                name: `Server ${i + 6}`,
                description: "Test server",
                ip: `192.168.1.${i + 6}`,
                mac: null,
                status: "ACTIVE",
                itemType: null,
                tags: [],
                customFieldValues: [],
                createdAt: new Date(),
                updatedAt: new Date(),
            }));

            prisma.configurationItem.count.mockResolvedValue(15);
            prisma.configurationItem.findMany.mockResolvedValue(mockItems);

            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.items).toHaveLength(5);
            expect(data.pagination).toEqual({
                total: 15,
                page: 2,
                limit: 5,
                totalPages: 3,
            });
        });

        it("searches across name, description, ip, and mac fields", async () => {
            request = createMockRequest(
                "http://localhost:3000/api/configuration-items?search=web"
            );
            getServerSession.mockResolvedValue({
                user: { id: "user-1", role: "USER" },
            });

            prisma.configurationItem.count.mockResolvedValue(2);
            prisma.configurationItem.findMany.mockResolvedValue([
                {
                    id: "item-1",
                    name: "web-server-01",
                    description: "Main web server",
                    ip: "10.0.0.1",
                    mac: "00:11:22:33:44:55",
                    status: "ACTIVE",
                    itemType: null,
                    tags: [],
                    customFieldValues: [],
                },
            ]);

            const response = await GET(request);

            expect(response.status).toBe(200);
            expect(prisma.configurationItem.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        OR: [
                            { name: { contains: "web" } },
                            { description: { contains: "web" } },
                            { ip: { contains: "web" } },
                            { mac: { contains: "web" } },
                        ],
                    }),
                })
            );
        });

        it("filters by item type ID", async () => {
            request = createMockRequest(
                "http://localhost:3000/api/configuration-items?typeId=type-123"
            );
            getServerSession.mockResolvedValue({
                user: { id: "user-1", role: "USER" },
            });

            prisma.configurationItem.count.mockResolvedValue(1);
            prisma.configurationItem.findMany.mockResolvedValue([
                {
                    id: "item-1",
                    name: "server-01",
                    itemTypeId: "type-123",
                    itemType: { id: "type-123", name: "Server" },
                    tags: [],
                    customFieldValues: [],
                },
            ]);

            const response = await GET(request);

            expect(response.status).toBe(200);
            expect(prisma.configurationItem.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        itemTypeId: "type-123",
                    }),
                })
            );
        });

        it("filters by status", async () => {
            request = createMockRequest(
                "http://localhost:3000/api/configuration-items?status=MAINTENANCE"
            );
            getServerSession.mockResolvedValue({
                user: { id: "user-1", role: "USER" },
            });

            prisma.configurationItem.count.mockResolvedValue(1);
            prisma.configurationItem.findMany.mockResolvedValue([
                {
                    id: "item-1",
                    name: "server-01",
                    status: "MAINTENANCE",
                    itemType: null,
                    tags: [],
                    customFieldValues: [],
                },
            ]);

            const response = await GET(request);

            expect(response.status).toBe(200);
            expect(prisma.configurationItem.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        status: "MAINTENANCE",
                    }),
                })
            );
        });

        it("combines search, filter, and pagination", async () => {
            request = createMockRequest(
                "http://localhost:3000/api/configuration-items?search=prod&typeId=type-1&status=ACTIVE&page=1&limit=10"
            );
            getServerSession.mockResolvedValue({
                user: { id: "user-1", role: "USER" },
            });

            prisma.configurationItem.count.mockResolvedValue(5);
            prisma.configurationItem.findMany.mockResolvedValue([]);

            await GET(request);

            expect(prisma.configurationItem.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: {
                        OR: [
                            { name: { contains: "prod" } },
                            { description: { contains: "prod" } },
                            { ip: { contains: "prod" } },
                            { mac: { contains: "prod" } },
                        ],
                        itemTypeId: "type-1",
                        status: "ACTIVE",
                    },
                    skip: 0,
                    take: 10,
                })
            );
        });

        it("formats custom fields correctly in response", async () => {
            request = createMockRequest("http://localhost:3000/api/configuration-items");
            getServerSession.mockResolvedValue({
                user: { id: "user-1", role: "USER" },
            });

            prisma.configurationItem.count.mockResolvedValue(1);
            prisma.configurationItem.findMany.mockResolvedValue([
                {
                    id: "item-1",
                    name: "server-01",
                    itemType: null,
                    tags: [],
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
                },
            ]);

            const response = await GET(request);
            const data = await response.json();

            expect(data.items[0].customFields).toEqual([
                {
                    id: "cf-1",
                    name: "purchase_date",
                    label: "Purchase Date",
                    type: "DATE",
                    value: "2024-01-15",
                },
                {
                    id: "cf-2",
                    name: "cost",
                    label: "Cost",
                    type: "NUMBER",
                    value: "1000.00",
                },
            ]);
            expect(data.items[0].customFieldValues).toBeUndefined();
        });

        it("includes tags in response", async () => {
            request = createMockRequest("http://localhost:3000/api/configuration-items");
            getServerSession.mockResolvedValue({
                user: { id: "user-1", role: "USER" },
            });

            prisma.configurationItem.count.mockResolvedValue(1);
            prisma.configurationItem.findMany.mockResolvedValue([
                {
                    id: "item-1",
                    name: "server-01",
                    itemType: null,
                    tags: [
                        { id: "tag-1", name: "production", color: "#ff0000" },
                        { id: "tag-2", name: "critical", color: "#ff8800" },
                    ],
                    customFieldValues: [],
                },
            ]);

            const response = await GET(request);
            const data = await response.json();

            expect(data.items[0].tags).toHaveLength(2);
            expect(data.items[0].tags[0].name).toBe("production");
        });

        it("handles empty search results gracefully", async () => {
            request = createMockRequest(
                "http://localhost:3000/api/configuration-items?search=nonexistent"
            );
            getServerSession.mockResolvedValue({
                user: { id: "user-1", role: "USER" },
            });

            prisma.configurationItem.count.mockResolvedValue(0);
            prisma.configurationItem.findMany.mockResolvedValue([]);

            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.items).toEqual([]);
            expect(data.pagination.total).toBe(0);
            expect(data.pagination.totalPages).toBe(0);
        });

        it("orders results by createdAt desc", async () => {
            request = createMockRequest("http://localhost:3000/api/configuration-items");
            getServerSession.mockResolvedValue({
                user: { id: "user-1", role: "USER" },
            });

            prisma.configurationItem.count.mockResolvedValue(0);
            prisma.configurationItem.findMany.mockResolvedValue([]);

            await GET(request);

            expect(prisma.configurationItem.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    orderBy: { createdAt: "desc" },
                })
            );
        });
    });

    describe("POST /api/configuration-items", () => {
        it("returns 401 when not authenticated", async () => {
            request = createMockRequest("http://localhost:3000/api/configuration-items", {
                body: { name: "New Server" },
            });
            getServerSession.mockResolvedValue(null);

            const response = await POST(request);
            const data = await response.json();

            expect(response.status).toBe(401);
            expect(data.error).toBe("Unauthorized");
        });

        it("returns 403 for read-only users", async () => {
            request = createMockRequest("http://localhost:3000/api/configuration-items", {
                body: { name: "New Server" },
            });
            getServerSession.mockResolvedValue({
                user: { id: "user-1", role: "READONLY" },
            });

            const response = await POST(request);
            const data = await response.json();

            expect(response.status).toBe(403);
            expect(data.error).toBe("Forbidden: Read-only access");
        });

        it("creates configuration item with minimal data", async () => {
            request = createMockRequest("http://localhost:3000/api/configuration-items", {
                body: { name: "New Server" },
            });
            getServerSession.mockResolvedValue({
                user: { id: "user-1", role: "USER" },
            });

            const createdItem = {
                id: "new-item-1",
                name: "New Server",
                description: null,
                ip: null,
                mac: null,
                status: "ACTIVE",
                itemTypeId: null,
                itemType: null,
                tags: [],
                userId: "user-1",
            };

            prisma.configurationItem.create.mockResolvedValue(createdItem);

            const response = await POST(request);
            const data = await response.json();

            expect(response.status).toBe(201);
            expect(data.name).toBe("New Server");
            expect(data.status).toBe("ACTIVE");
            expect(prisma.configurationItem.create).toHaveBeenCalledWith({
                data: {
                    name: "New Server",
                    description: undefined,
                    userId: "user-1",
                    itemTypeId: null,
                    ip: undefined,
                    mac: undefined,
                    status: "ACTIVE",
                },
                include: { itemType: true, tags: true },
            });
        });

        it("creates configuration item with all fields", async () => {
            request = createMockRequest("http://localhost:3000/api/configuration-items", {
                body: {
                    name: "Web Server 01",
                    description: "Production web server",
                    ip: "192.168.1.100",
                    mac: "00:11:22:33:44:55",
                    status: "ACTIVE",
                    itemTypeId: "type-web",
                },
            });
            getServerSession.mockResolvedValue({
                user: { id: "user-1", role: "ADMIN" },
            });

            const createdItem = {
                id: "new-item-1",
                name: "Web Server 01",
                description: "Production web server",
                ip: "192.168.1.100",
                mac: "00:11:22:33:44:55",
                status: "ACTIVE",
                itemTypeId: "type-web",
                itemType: { id: "type-web", name: "Web Server" },
                tags: [],
            };

            prisma.configurationItem.create.mockResolvedValue(createdItem);

            const response = await POST(request);
            const data = await response.json();

            expect(response.status).toBe(201);
            expect(data.name).toBe("Web Server 01");
            expect(data.ip).toBe("192.168.1.100");
            expect(data.mac).toBe("00:11:22:33:44:55");
        });

        it("creates configuration item with tags", async () => {
            request = createMockRequest("http://localhost:3000/api/configuration-items", {
                body: {
                    name: "Tagged Server",
                    tagIds: ["tag-1", "tag-2"],
                },
            });
            getServerSession.mockResolvedValue({
                user: { id: "user-1", role: "USER" },
            });

            const createdItem = {
                id: "new-item-1",
                name: "Tagged Server",
                tags: [
                    { id: "tag-1", name: "production" },
                    { id: "tag-2", name: "critical" },
                ],
            };

            prisma.configurationItem.create.mockResolvedValue(createdItem);

            const response = await POST(request);

            expect(response.status).toBe(201);
            expect(prisma.configurationItem.create).toHaveBeenCalledWith({
                data: expect.objectContaining({
                    tags: {
                        connect: [{ id: "tag-1" }, { id: "tag-2" }],
                    },
                }),
                include: { itemType: true, tags: true },
            });
        });

        it("allows ADMIN role to create items", async () => {
            request = createMockRequest("http://localhost:3000/api/configuration-items", {
                body: { name: "Admin Server" },
            });
            getServerSession.mockResolvedValue({
                user: { id: "admin-1", role: "ADMIN" },
            });

            prisma.configurationItem.create.mockResolvedValue({
                id: "new-item",
                name: "Admin Server",
            });

            const response = await POST(request);

            expect(response.status).toBe(201);
        });

        it("allows API role to create items", async () => {
            request = createMockRequest("http://localhost:3000/api/configuration-items", {
                body: { name: "API Server" },
            });
            getServerSession.mockResolvedValue({
                user: { id: "api-1", role: "API" },
            });

            prisma.configurationItem.create.mockResolvedValue({
                id: "new-item",
                name: "API Server",
            });

            const response = await POST(request);

            expect(response.status).toBe(201);
        });

        it("allows USER role to create items", async () => {
            request = createMockRequest("http://localhost:3000/api/configuration-items", {
                body: { name: "User Server" },
            });
            getServerSession.mockResolvedValue({
                user: { id: "user-1", role: "USER" },
            });

            prisma.configurationItem.create.mockResolvedValue({
                id: "new-item",
                name: "User Server",
            });

            const response = await POST(request);

            expect(response.status).toBe(201);
        });

        it("logs item creation via audit log", async () => {
            request = createMockRequest("http://localhost:3000/api/configuration-items", {
                body: { name: "Audited Server" },
            });
            getServerSession.mockResolvedValue({
                user: { id: "user-1", role: "USER" },
            });

            const createdItem = {
                id: "new-item-1",
                name: "Audited Server",
            };

            prisma.configurationItem.create.mockResolvedValue(createdItem);

            await POST(request);

            expect(logItemCreated).toHaveBeenCalledWith({
                item: createdItem,
                userId: "user-1",
                req: request,
            });
        });

        it("handles database errors gracefully", async () => {
            request = createMockRequest("http://localhost:3000/api/configuration-items", {
                body: { name: "Error Server" },
            });
            getServerSession.mockResolvedValue({
                user: { id: "user-1", role: "USER" },
            });

            prisma.configurationItem.create.mockRejectedValue(new Error("Database error"));

            await expect(POST(request)).rejects.toThrow("Database error");
        });
    });
});
