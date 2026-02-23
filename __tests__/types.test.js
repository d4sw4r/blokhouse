import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock prisma before importing the route
vi.mock("@/lib/prisma", () => ({
    default: {
        itemType: {
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

import { GET as getTypes, POST as createType } from "../app/api/types/route.js";
import { GET as getType, PUT as updateType, DELETE as deleteType } from "../app/api/types/[id]/route.js";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth/next";

describe("Types API (Item Types)", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    // Helper to create mock request
    function createMockRequest(options = {}) {
        return {
            url: options.url || "http://localhost:3000/api/types",
            headers: {
                get: vi.fn((header) => {
                    if (header === "authorization") return options.authHeader || null;
                    return null;
                }),
            },
            json: vi.fn().mockResolvedValue(options.body || {}),
        };
    }

    describe("GET /api/types", () => {
        it("returns 401 when not authenticated", async () => {
            const request = createMockRequest();
            prisma.apiToken.findUnique.mockResolvedValue(null);
            getServerSession.mockResolvedValue(null);

            const response = await getTypes(request);
            const data = await response.json();

            expect(response.status).toBe(401);
            expect(data.error).toBe("Unauthorized");
        });

        it("authenticates with valid API token", async () => {
            const request = createMockRequest({ authHeader: "Bearer valid-token" });
            prisma.apiToken.findUnique.mockResolvedValue({ token: "valid-token" });
            prisma.itemType.findMany.mockResolvedValue([]);

            const response = await getTypes(request);

            expect(response.status).toBe(200);
            expect(prisma.itemType.findMany).toHaveBeenCalled();
        });

        it("authenticates with valid session", async () => {
            const request = createMockRequest();
            prisma.apiToken.findUnique.mockResolvedValue(null);
            getServerSession.mockResolvedValue({ user: { id: "user-1", role: "USER" } });
            prisma.itemType.findMany.mockResolvedValue([]);

            const response = await getTypes(request);

            expect(response.status).toBe(200);
        });

        it("returns all item types", async () => {
            const request = createMockRequest();
            prisma.apiToken.findUnique.mockResolvedValue(null);
            getServerSession.mockResolvedValue({ user: { id: "user-1", role: "USER" } });

            const mockTypes = [
                { id: "type-1", name: "Server", description: "Physical servers" },
                { id: "type-2", name: "Database", description: "Database instances" },
                { id: "type-3", name: "Network", description: "Network equipment" },
            ];
            prisma.itemType.findMany.mockResolvedValue(mockTypes);

            const response = await getTypes(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data).toHaveLength(3);
            expect(data[0].name).toBe("Server");
            expect(data[1].name).toBe("Database");
            expect(data[2].name).toBe("Network");
        });

        it("returns empty array when no types exist", async () => {
            const request = createMockRequest();
            prisma.apiToken.findUnique.mockResolvedValue(null);
            getServerSession.mockResolvedValue({ user: { id: "user-1", role: "USER" } });
            prisma.itemType.findMany.mockResolvedValue([]);

            const response = await getTypes(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data).toEqual([]);
        });

        it("returns types without description", async () => {
            const request = createMockRequest();
            prisma.apiToken.findUnique.mockResolvedValue(null);
            getServerSession.mockResolvedValue({ user: { id: "user-1", role: "USER" } });

            const mockTypes = [
                { id: "type-1", name: "Server", description: null },
            ];
            prisma.itemType.findMany.mockResolvedValue(mockTypes);

            const response = await getTypes(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data[0].description).toBeNull();
        });
    });

    describe("POST /api/types", () => {
        it("returns 401 when not authenticated", async () => {
            const request = createMockRequest({ body: { name: "NewType" } });
            prisma.apiToken.findUnique.mockResolvedValue(null);
            getServerSession.mockResolvedValue(null);

            const response = await createType(request);
            const data = await response.json();

            expect(response.status).toBe(401);
            expect(data.error).toBe("Unauthorized");
        });

        it("creates type with name only", async () => {
            const request = createMockRequest({ body: { name: "Workstation" } });
            prisma.apiToken.findUnique.mockResolvedValue(null);
            getServerSession.mockResolvedValue({ user: { id: "user-1", role: "USER" } });

            const createdType = { id: "type-new", name: "Workstation", description: null };
            prisma.itemType.create.mockResolvedValue(createdType);

            const response = await createType(request);
            const data = await response.json();

            expect(response.status).toBe(201);
            expect(data.name).toBe("Workstation");
            expect(data.description).toBeNull();
        });

        it("creates type with name and description", async () => {
            const request = createMockRequest({
                body: { name: "Laptop", description: "Employee laptops" }
            });
            prisma.apiToken.findUnique.mockResolvedValue(null);
            getServerSession.mockResolvedValue({ user: { id: "user-1", role: "USER" } });

            const createdType = { id: "type-new", name: "Laptop", description: "Employee laptops" };
            prisma.itemType.create.mockResolvedValue(createdType);

            const response = await createType(request);
            const data = await response.json();

            expect(response.status).toBe(201);
            expect(data.name).toBe("Laptop");
            expect(data.description).toBe("Employee laptops");
        });

        it("authenticates via API token for creation", async () => {
            const request = createMockRequest({
                body: { name: "APIType" },
                authHeader: "Bearer valid-token"
            });
            prisma.apiToken.findUnique.mockResolvedValue({ token: "valid-token" });

            const createdType = { id: "type-api", name: "APIType", description: null };
            prisma.itemType.create.mockResolvedValue(createdType);

            const response = await createType(request);

            expect(response.status).toBe(201);
        });

        it("handles database errors gracefully", async () => {
            const request = createMockRequest({ body: { name: "ErrorType" } });
            prisma.apiToken.findUnique.mockResolvedValue(null);
            getServerSession.mockResolvedValue({ user: { id: "user-1", role: "USER" } });
            prisma.itemType.create.mockRejectedValue(new Error("DB Error"));

            const response = await createType(request);
            const data = await response.json();

            expect(response.status).toBe(500);
            expect(data.error).toBe("Could not create type");
        });
    });

    describe("GET /api/types/[id]", () => {
        it("returns 401 when not authenticated", async () => {
            const request = createMockRequest();
            getServerSession.mockResolvedValue(null);

            const response = await getType(request, { params: { id: "type-1" } });
            const data = await response.json();

            expect(response.status).toBe(401);
            expect(data.error).toBe("Unauthorized");
        });

        it("returns 404 when type does not exist", async () => {
            const request = createMockRequest();
            getServerSession.mockResolvedValue({ user: { id: "user-1", role: "USER" } });
            prisma.itemType.findUnique.mockResolvedValue(null);

            const response = await getType(request, { params: { id: "nonexistent" } });
            const data = await response.json();

            expect(response.status).toBe(404);
            expect(data.error).toBe("Not found");
        });

        it("returns single type by id", async () => {
            const request = createMockRequest();
            getServerSession.mockResolvedValue({ user: { id: "user-1", role: "USER" } });

            const mockType = { id: "type-1", name: "Server", description: "Physical servers" };
            prisma.itemType.findUnique.mockResolvedValue(mockType);

            const response = await getType(request, { params: { id: "type-1" } });
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.id).toBe("type-1");
            expect(data.name).toBe("Server");
            expect(data.description).toBe("Physical servers");
        });

        it("queries with correct where clause", async () => {
            const request = createMockRequest();
            getServerSession.mockResolvedValue({ user: { id: "user-1", role: "USER" } });

            prisma.itemType.findUnique.mockResolvedValue({ id: "type-1", name: "Test" });

            await getType(request, { params: { id: "type-abc-123" } });

            expect(prisma.itemType.findUnique).toHaveBeenCalledWith({
                where: { id: "type-abc-123" }
            });
        });
    });

    describe("PUT /api/types/[id]", () => {
        it("returns 401 when not authenticated", async () => {
            const request = createMockRequest({ body: { name: "Updated" } });
            getServerSession.mockResolvedValue(null);

            const response = await updateType(request, { params: { id: "type-1" } });
            const data = await response.json();

            expect(response.status).toBe(401);
            expect(data.error).toBe("Unauthorized");
        });

        it("updates type name and description", async () => {
            const request = createMockRequest({
                body: { name: "Updated Server", description: "Updated description" }
            });
            getServerSession.mockResolvedValue({ user: { id: "user-1", role: "USER" } });

            const updatedType = { id: "type-1", name: "Updated Server", description: "Updated description" };
            prisma.itemType.update.mockResolvedValue(updatedType);

            const response = await updateType(request, { params: { id: "type-1" } });
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.name).toBe("Updated Server");
            expect(data.description).toBe("Updated description");
        });

        it("updates only name", async () => {
            const request = createMockRequest({ body: { name: "New Name" } });
            getServerSession.mockResolvedValue({ user: { id: "user-1", role: "USER" } });

            const updatedType = { id: "type-1", name: "New Name", description: "Old desc" };
            prisma.itemType.update.mockResolvedValue(updatedType);

            const response = await updateType(request, { params: { id: "type-1" } });
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.name).toBe("New Name");
        });

        it("updates only description", async () => {
            const request = createMockRequest({ body: { description: "New description" } });
            getServerSession.mockResolvedValue({ user: { id: "user-1", role: "USER" } });

            const updatedType = { id: "type-1", name: "Server", description: "New description" };
            prisma.itemType.update.mockResolvedValue(updatedType);

            const response = await updateType(request, { params: { id: "type-1" } });
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.description).toBe("New description");
        });

        it("handles database errors during update", async () => {
            const request = createMockRequest({ body: { name: "Error" } });
            getServerSession.mockResolvedValue({ user: { id: "user-1", role: "USER" } });
            prisma.itemType.update.mockRejectedValue(new Error("DB Error"));

            const response = await updateType(request, { params: { id: "type-1" } });
            const data = await response.json();

            expect(response.status).toBe(500);
            expect(data.error).toBe("Update failed");
        });
    });

    describe("DELETE /api/types/[id]", () => {
        it("returns 401 when not authenticated", async () => {
            const request = createMockRequest();
            getServerSession.mockResolvedValue(null);

            const response = await deleteType(request, { params: { id: "type-1" } });
            const data = await response.json();

            expect(response.status).toBe(401);
            expect(data.error).toBe("Unauthorized");
        });

        it("deletes type and returns success message", async () => {
            const request = createMockRequest();
            getServerSession.mockResolvedValue({ user: { id: "user-1", role: "USER" } });
            prisma.itemType.delete.mockResolvedValue({ id: "type-1", name: "Deleted" });

            const response = await deleteType(request, { params: { id: "type-1" } });
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.message).toBe("Deleted");
            expect(prisma.itemType.delete).toHaveBeenCalledWith({ where: { id: "type-1" } });
        });

        it("handles database errors during deletion", async () => {
            const request = createMockRequest();
            getServerSession.mockResolvedValue({ user: { id: "user-1", role: "USER" } });
            prisma.itemType.delete.mockRejectedValue(new Error("DB Error"));

            const response = await deleteType(request, { params: { id: "type-1" } });
            const data = await response.json();

            expect(response.status).toBe(500);
            expect(data.error).toBe("Delete failed");
        });

        it("handles deletion of non-existent type", async () => {
            const request = createMockRequest();
            getServerSession.mockResolvedValue({ user: { id: "user-1", role: "USER" } });

            const error = new Error("Record not found");
            prisma.itemType.delete.mockRejectedValue(error);

            const response = await deleteType(request, { params: { id: "nonexistent" } });
            const data = await response.json();

            expect(response.status).toBe(500);
            expect(data.error).toBe("Delete failed");
        });
    });
});
