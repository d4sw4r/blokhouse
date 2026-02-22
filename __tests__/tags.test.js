import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock prisma before importing the route
vi.mock("@/lib/prisma", () => ({
    default: {
        tag: {
            findMany: vi.fn(),
            create: vi.fn(),
            findUnique: vi.fn(),
            update: vi.fn(),
            delete: vi.fn(),
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

// Mock authOptions
vi.mock("@/lib/authOptions", () => ({
    default: {},
}));

import { GET as getTags, POST as createTag } from "../app/api/tags/route.js";
import { GET as getTag, PUT as updateTag, DELETE as deleteTag } from "../app/api/tags/[id]/route.js";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth/next";

describe("Tags API", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    // Helper to create mock request
    function createMockRequest(options = {}) {
        return {
            url: options.url || "http://localhost:3000/api/tags",
            headers: {
                get: vi.fn((header) => {
                    if (header === "authorization") return options.authHeader || null;
                    return null;
                }),
            },
            json: vi.fn().mockResolvedValue(options.body || {}),
        };
    }

    // Helper for params
    function createParams(id) {
        return Promise.resolve({ id });
    }

    describe("GET /api/tags", () => {
        it("returns 401 when not authenticated", async () => {
            const request = createMockRequest();
            getServerSession.mockResolvedValue(null);
            prisma.apiToken.findUnique.mockResolvedValue(null);

            const response = await getTags(request);
            const data = await response.json();

            expect(response.status).toBe(401);
            expect(data.error).toBe("Unauthorized");
        });

        it("authenticates with valid API token", async () => {
            const request = createMockRequest({ authHeader: "Bearer valid-token" });
            prisma.apiToken.findUnique.mockResolvedValue({ token: "valid-token" });
            prisma.tag.findMany.mockResolvedValue([]);

            const response = await getTags(request);

            expect(response.status).toBe(200);
            expect(prisma.tag.findMany).toHaveBeenCalled();
        });

        it("authenticates with valid session", async () => {
            const request = createMockRequest();
            getServerSession.mockResolvedValue({ user: { id: "user-1", role: "USER" } });
            prisma.tag.findMany.mockResolvedValue([]);

            const response = await getTags(request);

            expect(response.status).toBe(200);
        });

        it("returns tags with usage count", async () => {
            const request = createMockRequest();
            getServerSession.mockResolvedValue({ user: { id: "user-1", role: "USER" } });

            const mockTags = [
                { id: "tag-1", name: "production", color: "#ff0000", description: "Prod servers", _count: { configurationItems: 5 } },
                { id: "tag-2", name: "development", color: "#00ff00", description: "Dev servers", _count: { configurationItems: 3 } },
            ];
            prisma.tag.findMany.mockResolvedValue(mockTags);

            const response = await getTags(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data).toHaveLength(2);
            expect(data[0]._count.configurationItems).toBe(5);
            expect(data[1]._count.configurationItems).toBe(3);
        });

        it("orders tags by name ascending", async () => {
            const request = createMockRequest();
            getServerSession.mockResolvedValue({ user: { id: "user-1", role: "USER" } });
            prisma.tag.findMany.mockResolvedValue([]);

            await getTags(request);

            expect(prisma.tag.findMany).toHaveBeenCalledWith({
                include: { _count: { select: { configurationItems: true } } },
                orderBy: { name: "asc" },
            });
        });

        it("returns empty array when no tags exist", async () => {
            const request = createMockRequest();
            getServerSession.mockResolvedValue({ user: { id: "user-1", role: "USER" } });
            prisma.tag.findMany.mockResolvedValue([]);

            const response = await getTags(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data).toEqual([]);
        });

        it("handles database errors gracefully", async () => {
            const request = createMockRequest();
            getServerSession.mockResolvedValue({ user: { id: "user-1", role: "USER" } });
            prisma.tag.findMany.mockRejectedValue(new Error("DB Error"));

            const response = await getTags(request);
            const data = await response.json();

            expect(response.status).toBe(500);
            expect(data.error).toBe("Failed to fetch tags");
        });
    });

    describe("POST /api/tags", () => {
        it("returns 401 when not authenticated", async () => {
            const request = createMockRequest({ body: { name: "new-tag" } });
            getServerSession.mockResolvedValue(null);

            const response = await createTag(request);
            const data = await response.json();

            expect(response.status).toBe(401);
            expect(data.error).toBe("Unauthorized");
        });

        it("returns 403 for read-only users", async () => {
            const request = createMockRequest({ body: { name: "new-tag" } });
            getServerSession.mockResolvedValue({ user: { id: "user-1", role: "READONLY" } });

            const response = await createTag(request);
            const data = await response.json();

            expect(response.status).toBe(403);
            expect(data.error).toBe("Forbidden: Read-only access");
        });

        it("returns 400 when name is missing", async () => {
            const request = createMockRequest({ body: {} });
            getServerSession.mockResolvedValue({ user: { id: "user-1", role: "USER" } });

            const response = await createTag(request);
            const data = await response.json();

            expect(response.status).toBe(400);
            expect(data.error).toBe("Tag name is required");
        });

        it("returns 400 when name is empty string", async () => {
            const request = createMockRequest({ body: { name: "   " } });
            getServerSession.mockResolvedValue({ user: { id: "user-1", role: "USER" } });

            const response = await createTag(request);
            const data = await response.json();

            expect(response.status).toBe(400);
            expect(data.error).toBe("Tag name is required");
        });

        it("normalizes tag name to lowercase", async () => {
            const request = createMockRequest({ body: { name: "PRODUCTION" } });
            getServerSession.mockResolvedValue({ user: { id: "user-1", role: "USER" } });

            const createdTag = { id: "tag-1", name: "production", color: null, description: null, _count: { configurationItems: 0 } };
            prisma.tag.create.mockResolvedValue(createdTag);

            await createTag(request);

            expect(prisma.tag.create).toHaveBeenCalledWith({
                data: { name: "production", color: null, description: null },
                include: { _count: { select: { configurationItems: true } } },
            });
        });

        it("trims whitespace from tag name", async () => {
            const request = createMockRequest({ body: { name: "  staging  " } });
            getServerSession.mockResolvedValue({ user: { id: "user-1", role: "USER" } });

            const createdTag = { id: "tag-1", name: "staging", color: null, description: null, _count: { configurationItems: 0 } };
            prisma.tag.create.mockResolvedValue(createdTag);

            await createTag(request);

            expect(prisma.tag.create).toHaveBeenCalledWith({
                data: { name: "staging", color: null, description: null },
                include: { _count: { select: { configurationItems: true } } },
            });
        });

        it("creates tag with all fields", async () => {
            const request = createMockRequest({
                body: { name: "critical", color: "#ff0000", description: "Critical systems" }
            });
            getServerSession.mockResolvedValue({ user: { id: "user-1", role: "USER" } });

            const createdTag = {
                id: "tag-1",
                name: "critical",
                color: "#ff0000",
                description: "Critical systems",
                _count: { configurationItems: 0 }
            };
            prisma.tag.create.mockResolvedValue(createdTag);

            const response = await createTag(request);
            const data = await response.json();

            expect(response.status).toBe(201);
            expect(data.name).toBe("critical");
            expect(data.color).toBe("#ff0000");
            expect(data.description).toBe("Critical systems");
        });

        it("returns 409 when tag name already exists", async () => {
            const request = createMockRequest({ body: { name: "existing" } });
            getServerSession.mockResolvedValue({ user: { id: "user-1", role: "USER" } });

            const error = new Error("Duplicate");
            error.code = "P2002";
            prisma.tag.create.mockRejectedValue(error);

            const response = await createTag(request);
            const data = await response.json();

            expect(response.status).toBe(409);
            expect(data.error).toBe("Tag with this name already exists");
        });

        it("handles database errors gracefully", async () => {
            const request = createMockRequest({ body: { name: "new-tag" } });
            getServerSession.mockResolvedValue({ user: { id: "user-1", role: "USER" } });
            prisma.tag.create.mockRejectedValue(new Error("DB Error"));

            const response = await createTag(request);
            const data = await response.json();

            expect(response.status).toBe(500);
            expect(data.error).toBe("Failed to create tag");
        });

        it("allows ADMIN role to create tags", async () => {
            const request = createMockRequest({ body: { name: "admin-tag" } });
            getServerSession.mockResolvedValue({ user: { id: "admin-1", role: "ADMIN" } });

            const createdTag = { id: "tag-1", name: "admin-tag", color: null, description: null, _count: { configurationItems: 0 } };
            prisma.tag.create.mockResolvedValue(createdTag);

            const response = await createTag(request);

            expect(response.status).toBe(201);
        });

        it("allows API role to create tags", async () => {
            const request = createMockRequest({ body: { name: "api-tag" } });
            getServerSession.mockResolvedValue({ user: { id: "api-1", role: "API" } });

            const createdTag = { id: "tag-1", name: "api-tag", color: null, description: null, _count: { configurationItems: 0 } };
            prisma.tag.create.mockResolvedValue(createdTag);

            const response = await createTag(request);

            expect(response.status).toBe(201);
        });
    });

    describe("GET /api/tags/[id]", () => {
        it("returns 401 when not authenticated", async () => {
            const request = createMockRequest();
            getServerSession.mockResolvedValue(null);
            const params = createParams("tag-1");

            const response = await getTag(request, { params });
            const data = await response.json();

            expect(response.status).toBe(401);
            expect(data.error).toBe("Unauthorized");
        });

        it("returns 404 when tag does not exist", async () => {
            const request = createMockRequest();
            getServerSession.mockResolvedValue({ user: { id: "user-1", role: "USER" } });
            prisma.tag.findUnique.mockResolvedValue(null);
            const params = createParams("nonexistent");

            const response = await getTag(request, { params });
            const data = await response.json();

            expect(response.status).toBe(404);
            expect(data.error).toBe("Tag not found");
        });

        it("returns tag with associated configuration items", async () => {
            const request = createMockRequest();
            getServerSession.mockResolvedValue({ user: { id: "user-1", role: "USER" } });

            const mockTag = {
                id: "tag-1",
                name: "production",
                color: "#ff0000",
                description: "Production systems",
                configurationItems: [
                    { id: "item-1", name: "server-01", ip: "10.0.0.1", description: "Main server" },
                    { id: "item-2", name: "server-02", ip: "10.0.0.2", description: "Backup server" },
                ],
            };
            prisma.tag.findUnique.mockResolvedValue(mockTag);
            const params = createParams("tag-1");

            const response = await getTag(request, { params });
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.name).toBe("production");
            expect(data.configurationItems).toHaveLength(2);
            expect(data.configurationItems[0].name).toBe("server-01");
        });

        it("returns tag with empty configuration items array", async () => {
            const request = createMockRequest();
            getServerSession.mockResolvedValue({ user: { id: "user-1", role: "USER" } });

            const mockTag = {
                id: "tag-1",
                name: "unused",
                color: null,
                description: null,
                configurationItems: [],
            };
            prisma.tag.findUnique.mockResolvedValue(mockTag);
            const params = createParams("tag-1");

            const response = await getTag(request, { params });
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.configurationItems).toEqual([]);
        });

        it("handles database errors gracefully", async () => {
            const request = createMockRequest();
            getServerSession.mockResolvedValue({ user: { id: "user-1", role: "USER" } });
            prisma.tag.findUnique.mockRejectedValue(new Error("DB Error"));
            const params = createParams("tag-1");

            const response = await getTag(request, { params });
            const data = await response.json();

            expect(response.status).toBe(500);
            expect(data.error).toBe("Failed to fetch tag");
        });
    });

    describe("PUT /api/tags/[id]", () => {
        it("returns 401 when not authenticated", async () => {
            const request = createMockRequest({ body: { name: "updated" } });
            getServerSession.mockResolvedValue(null);
            const params = createParams("tag-1");

            const response = await updateTag(request, { params });
            const data = await response.json();

            expect(response.status).toBe(401);
            expect(data.error).toBe("Unauthorized");
        });

        it("returns 403 for read-only users", async () => {
            const request = createMockRequest({ body: { name: "updated" } });
            getServerSession.mockResolvedValue({ user: { id: "user-1", role: "READONLY" } });
            const params = createParams("tag-1");

            const response = await updateTag(request, { params });
            const data = await response.json();

            expect(response.status).toBe(403);
            expect(data.error).toBe("Forbidden: Read-only access");
        });

        it("returns 404 when tag does not exist", async () => {
            const request = createMockRequest({ body: { name: "updated" } });
            getServerSession.mockResolvedValue({ user: { id: "user-1", role: "USER" } });

            const error = new Error("Not found");
            error.code = "P2025";
            prisma.tag.update.mockRejectedValue(error);
            const params = createParams("nonexistent");

            const response = await updateTag(request, { params });
            const data = await response.json();

            expect(response.status).toBe(404);
            expect(data.error).toBe("Tag not found");
        });

        it("updates tag name and normalizes to lowercase", async () => {
            const request = createMockRequest({ body: { name: "NEW-NAME" } });
            getServerSession.mockResolvedValue({ user: { id: "user-1", role: "USER" } });

            const updatedTag = { id: "tag-1", name: "new-name", color: null, description: null, _count: { configurationItems: 0 } };
            prisma.tag.update.mockResolvedValue(updatedTag);
            const params = createParams("tag-1");

            await updateTag(request, { params });

            expect(prisma.tag.update).toHaveBeenCalledWith({
                where: { id: "tag-1" },
                data: { name: "new-name" },
                include: { _count: { select: { configurationItems: true } } },
            });
        });

        it("updates tag color", async () => {
            const request = createMockRequest({ body: { color: "#00ff00" } });
            getServerSession.mockResolvedValue({ user: { id: "user-1", role: "USER" } });

            const updatedTag = { id: "tag-1", name: "production", color: "#00ff00", description: null, _count: { configurationItems: 5 } };
            prisma.tag.update.mockResolvedValue(updatedTag);
            const params = createParams("tag-1");

            const response = await updateTag(request, { params });
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.color).toBe("#00ff00");
        });

        it("updates tag description", async () => {
            const request = createMockRequest({ body: { description: "Updated description" } });
            getServerSession.mockResolvedValue({ user: { id: "user-1", role: "USER" } });

            const updatedTag = { id: "tag-1", name: "production", color: null, description: "Updated description", _count: { configurationItems: 5 } };
            prisma.tag.update.mockResolvedValue(updatedTag);
            const params = createParams("tag-1");

            const response = await updateTag(request, { params });
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.description).toBe("Updated description");
        });

        it("updates all fields at once", async () => {
            const request = createMockRequest({
                body: { name: "staging", color: "#0000ff", description: "Staging env" }
            });
            getServerSession.mockResolvedValue({ user: { id: "user-1", role: "USER" } });

            const updatedTag = {
                id: "tag-1",
                name: "staging",
                color: "#0000ff",
                description: "Staging env",
                _count: { configurationItems: 3 }
            };
            prisma.tag.update.mockResolvedValue(updatedTag);
            const params = createParams("tag-1");

            const response = await updateTag(request, { params });
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.name).toBe("staging");
            expect(data.color).toBe("#0000ff");
            expect(data.description).toBe("Staging env");
        });

        it("returns 409 when new name already exists", async () => {
            const request = createMockRequest({ body: { name: "existing" } });
            getServerSession.mockResolvedValue({ user: { id: "user-1", role: "USER" } });

            const error = new Error("Duplicate");
            error.code = "P2002";
            prisma.tag.update.mockRejectedValue(error);
            const params = createParams("tag-1");

            const response = await updateTag(request, { params });
            const data = await response.json();

            expect(response.status).toBe(409);
            expect(data.error).toBe("Tag with this name already exists");
        });

        it("handles database errors gracefully", async () => {
            const request = createMockRequest({ body: { name: "updated" } });
            getServerSession.mockResolvedValue({ user: { id: "user-1", role: "USER" } });
            prisma.tag.update.mockRejectedValue(new Error("DB Error"));
            const params = createParams("tag-1");

            const response = await updateTag(request, { params });
            const data = await response.json();

            expect(response.status).toBe(500);
            expect(data.error).toBe("Failed to update tag");
        });
    });

    describe("DELETE /api/tags/[id]", () => {
        it("returns 401 when not authenticated", async () => {
            const request = createMockRequest();
            getServerSession.mockResolvedValue(null);
            const params = createParams("tag-1");

            const response = await deleteTag(request, { params });
            const data = await response.json();

            expect(response.status).toBe(401);
            expect(data.error).toBe("Unauthorized");
        });

        it("returns 403 for read-only users", async () => {
            const request = createMockRequest();
            getServerSession.mockResolvedValue({ user: { id: "user-1", role: "READONLY" } });
            const params = createParams("tag-1");

            const response = await deleteTag(request, { params });
            const data = await response.json();

            expect(response.status).toBe(403);
            expect(data.error).toBe("Forbidden: Read-only access");
        });

        it("returns 404 when tag does not exist", async () => {
            const request = createMockRequest();
            getServerSession.mockResolvedValue({ user: { id: "user-1", role: "USER" } });

            const error = new Error("Not found");
            error.code = "P2025";
            prisma.tag.delete.mockRejectedValue(error);
            const params = createParams("nonexistent");

            const response = await deleteTag(request, { params });
            const data = await response.json();

            expect(response.status).toBe(404);
            expect(data.error).toBe("Tag not found");
        });

        it("deletes tag and returns success message", async () => {
            const request = createMockRequest();
            getServerSession.mockResolvedValue({ user: { id: "user-1", role: "USER" } });
            prisma.tag.delete.mockResolvedValue({ id: "tag-1", name: "deleted" });
            const params = createParams("tag-1");

            const response = await deleteTag(request, { params });
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.message).toBe("Tag deleted");
            expect(prisma.tag.delete).toHaveBeenCalledWith({ where: { id: "tag-1" } });
        });

        it("handles database errors gracefully", async () => {
            const request = createMockRequest();
            getServerSession.mockResolvedValue({ user: { id: "user-1", role: "USER" } });
            prisma.tag.delete.mockRejectedValue(new Error("DB Error"));
            const params = createParams("tag-1");

            const response = await deleteTag(request, { params });
            const data = await response.json();

            expect(response.status).toBe(500);
            expect(data.error).toBe("Failed to delete tag");
        });

        it("allows ADMIN role to delete tags", async () => {
            const request = createMockRequest();
            getServerSession.mockResolvedValue({ user: { id: "admin-1", role: "ADMIN" } });
            prisma.tag.delete.mockResolvedValue({ id: "tag-1", name: "deleted" });
            const params = createParams("tag-1");

            const response = await deleteTag(request, { params });

            expect(response.status).toBe(200);
        });

        it("allows API role to delete tags", async () => {
            const request = createMockRequest();
            getServerSession.mockResolvedValue({ user: { id: "api-1", role: "API" } });
            prisma.tag.delete.mockResolvedValue({ id: "tag-1", name: "deleted" });
            const params = createParams("tag-1");

            const response = await deleteTag(request, { params });

            expect(response.status).toBe(200);
        });
    });
});
