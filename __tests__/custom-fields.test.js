import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { GET, POST } from "../app/api/custom-fields/route.js";

// Mock prisma
vi.mock("@/lib/prisma", () => ({
    default: {
        customField: {
            findMany: vi.fn(),
            create: vi.fn(),
        },
    },
}));

// Mock next-auth
vi.mock("next-auth/next", () => ({
    getServerSession: vi.fn(),
}));

import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth/next";

describe("Custom Fields API", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.resetAllMocks();
    });

    describe("GET /api/custom-fields", () => {
        it("returns 401 when not authenticated", async () => {
            getServerSession.mockResolvedValueOnce(null);

            const request = { url: "http://localhost:3000/api/custom-fields" };
            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(401);
            expect(data.error).toBe("Unauthorized");
        });

        it("returns all custom fields when authenticated", async () => {
            getServerSession.mockResolvedValueOnce({ user: { id: "user-1" } });
            
            const mockFields = [
                { id: "field-1", name: "purchase_date", label: "Purchase Date", type: "DATE" },
                { id: "field-2", name: "cost", label: "Cost", type: "NUMBER" },
            ];
            prisma.customField.findMany.mockResolvedValueOnce(mockFields);

            const request = { url: "http://localhost:3000/api/custom-fields" };
            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data).toHaveLength(2);
            expect(data[0].name).toBe("purchase_date");
        });

        it("filters by itemTypeId when provided", async () => {
            getServerSession.mockResolvedValueOnce({ user: { id: "user-1" } });
            
            const mockFields = [{ id: "field-1", name: "serial", label: "Serial Number" }];
            prisma.customField.findMany.mockResolvedValueOnce(mockFields);

            const request = { url: "http://localhost:3000/api/custom-fields?itemTypeId=type-1" };
            const response = await GET(request);

            expect(response.status).toBe(200);
            expect(prisma.customField.findMany).toHaveBeenCalledWith({
                where: {
                    OR: [
                        { itemTypeId: "type-1" },
                        { itemTypeId: null },
                    ],
                },
                include: { itemType: true },
                orderBy: { name: "asc" },
            });
        });

        it("returns empty array when no custom fields exist", async () => {
            getServerSession.mockResolvedValueOnce({ user: { id: "user-1" } });
            prisma.customField.findMany.mockResolvedValueOnce([]);

            const request = { url: "http://localhost:3000/api/custom-fields" };
            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data).toEqual([]);
        });

        it("includes itemType relation in response", async () => {
            getServerSession.mockResolvedValueOnce({ user: { id: "user-1" } });
            
            const mockFields = [
                { 
                    id: "field-1", 
                    name: "location", 
                    label: "Location", 
                    type: "STRING",
                    itemType: { id: "type-1", name: "Server" }
                },
            ];
            prisma.customField.findMany.mockResolvedValueOnce(mockFields);

            const request = { url: "http://localhost:3000/api/custom-fields" };
            const response = await GET(request);
            const data = await response.json();

            expect(data[0].itemType).toBeDefined();
            expect(data[0].itemType.name).toBe("Server");
        });

        it("returns 500 when database query fails", async () => {
            getServerSession.mockResolvedValueOnce({ user: { id: "user-1" } });
            prisma.customField.findMany.mockRejectedValueOnce(new Error("DB Error"));

            const request = { url: "http://localhost:3000/api/custom-fields" };
            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(500);
            expect(data.error).toBe("Failed to fetch custom fields");
        });
    });

    describe("POST /api/custom-fields", () => {
        it("returns 401 when not authenticated", async () => {
            getServerSession.mockResolvedValueOnce(null);

            const request = {
                json: vi.fn().mockResolvedValueOnce({}),
            };
            const response = await POST(request);
            const data = await response.json();

            expect(response.status).toBe(401);
            expect(data.error).toBe("Unauthorized");
        });

        it("returns 403 when user has read-only access", async () => {
            getServerSession.mockResolvedValueOnce({ user: { id: "user-1", role: "AUDIT" } });

            const request = {
                json: vi.fn().mockResolvedValueOnce({
                    name: "location",
                    label: "Location",
                    type: "STRING",
                }),
            };
            const response = await POST(request);
            const data = await response.json();

            expect(response.status).toBe(403);
            expect(data.error).toBe("Forbidden");
        });

        it("returns 400 when required fields are missing", async () => {
            getServerSession.mockResolvedValueOnce({ user: { id: "user-1", role: "ADMIN" } });

            const request = {
                json: vi.fn().mockResolvedValueOnce({
                    name: "location",
                    // label is missing
                    type: "STRING",
                }),
            };
            const response = await POST(request);
            const data = await response.json();

            expect(response.status).toBe(400);
            expect(data.error).toContain("name, label, and type are required");
        });

        it("returns 400 when type is invalid", async () => {
            getServerSession.mockResolvedValueOnce({ user: { id: "user-1", role: "ADMIN" } });

            const request = {
                json: vi.fn().mockResolvedValueOnce({
                    name: "location",
                    label: "Location",
                    type: "INVALID_TYPE",
                }),
            };
            const response = await POST(request);
            const data = await response.json();

            expect(response.status).toBe(400);
            expect(data.error).toContain("Invalid type");
        });

        it("creates custom field with valid data", async () => {
            getServerSession.mockResolvedValueOnce({ user: { id: "user-1", role: "ADMIN" } });
            
            const mockField = {
                id: "field-1",
                name: "purchase_date",
                label: "Purchase Date",
                description: "When the item was purchased",
                type: "DATE",
                required: false,
                defaultValue: null,
                options: [],
                itemTypeId: null,
                itemType: null,
            };
            prisma.customField.create.mockResolvedValueOnce(mockField);

            const request = {
                json: vi.fn().mockResolvedValueOnce({
                    name: "purchase_date",
                    label: "Purchase Date",
                    description: "When the item was purchased",
                    type: "DATE",
                    required: false,
                }),
            };
            const response = await POST(request);
            const data = await response.json();

            expect(response.status).toBe(201);
            expect(data.name).toBe("purchase_date");
            expect(data.label).toBe("Purchase Date");
            expect(data.type).toBe("DATE");
        });

        it("normalizes field name to snake_case", async () => {
            getServerSession.mockResolvedValueOnce({ user: { id: "user-1", role: "ADMIN" } });
            
            prisma.customField.create.mockImplementationOnce(async ({ data }) => ({
                id: "field-1",
                ...data,
                itemType: null,
            }));

            const request = {
                json: vi.fn().mockResolvedValueOnce({
                    name: "Purchase Date!!!",
                    label: "Purchase Date",
                    type: "DATE",
                }),
            };
            const response = await POST(request);

            expect(prisma.customField.create).toHaveBeenCalledWith({
                data: expect.objectContaining({
                    name: "purchase_date",
                }),
                include: { itemType: true },
            });
        });

        it("accepts all valid field types", async () => {
            const validTypes = ["STRING", "NUMBER", "BOOLEAN", "DATE", "URL", "EMAIL"];
            
            for (const type of validTypes) {
                getServerSession.mockResolvedValueOnce({ user: { id: "user-1", role: "ADMIN" } });
                prisma.customField.create.mockResolvedValueOnce({
                    id: `field-${type}`,
                    name: `field_${type.toLowerCase()}`,
                    label: `Field ${type}`,
                    type,
                });

                const request = {
                    json: vi.fn().mockResolvedValueOnce({
                        name: `field_${type.toLowerCase()}`,
                        label: `Field ${type}`,
                        type,
                    }),
                };
                const response = await POST(request);
                expect(response.status).toBe(201);
            }
        });

        it("handles options array for STRING type", async () => {
            getServerSession.mockResolvedValueOnce({ user: { id: "user-1", role: "ADMIN" } });
            
            prisma.customField.create.mockImplementationOnce(async ({ data }) => ({
                id: "field-1",
                ...data,
                itemType: null,
            }));

            const request = {
                json: vi.fn().mockResolvedValueOnce({
                    name: "status",
                    label: "Status",
                    type: "STRING",
                    options: ["active", "inactive", "pending"],
                }),
            };
            const response = await POST(request);

            expect(prisma.customField.create).toHaveBeenCalledWith({
                data: expect.objectContaining({
                    options: ["active", "inactive", "pending"],
                }),
                include: { itemType: true },
            });
        });

        it("assigns field to specific item type", async () => {
            getServerSession.mockResolvedValueOnce({ user: { id: "user-1", role: "ADMIN" } });
            
            const mockField = {
                id: "field-1",
                name: "ram",
                label: "RAM (GB)",
                type: "NUMBER",
                itemTypeId: "server-type",
                itemType: { id: "server-type", name: "Server" },
            };
            prisma.customField.create.mockResolvedValueOnce(mockField);

            const request = {
                json: vi.fn().mockResolvedValueOnce({
                    name: "ram",
                    label: "RAM (GB)",
                    type: "NUMBER",
                    itemTypeId: "server-type",
                }),
            };
            const response = await POST(request);
            const data = await response.json();

            expect(response.status).toBe(201);
            expect(data.itemTypeId).toBe("server-type");
        });

        it("returns 409 when field name already exists for type", async () => {
            getServerSession.mockResolvedValueOnce({ user: { id: "user-1", role: "ADMIN" } });
            
            const error = new Error("Unique constraint failed");
            error.code = "P2002";
            prisma.customField.create.mockRejectedValueOnce(error);

            const request = {
                json: vi.fn().mockResolvedValueOnce({
                    name: "purchase_date",
                    label: "Purchase Date",
                    type: "DATE",
                }),
            };
            const response = await POST(request);
            const data = await response.json();

            expect(response.status).toBe(409);
            expect(data.error).toContain("already exists");
        });

        it("allows ADMIN role to create fields", async () => {
            getServerSession.mockResolvedValueOnce({ user: { id: "user-1", role: "ADMIN" } });
            prisma.customField.create.mockResolvedValueOnce({ id: "field-1", name: "test" });

            const request = {
                json: vi.fn().mockResolvedValueOnce({
                    name: "test",
                    label: "Test",
                    type: "STRING",
                }),
            };
            const response = await POST(request);

            expect(response.status).toBe(201);
        });

        it("allows USER role to create fields", async () => {
            getServerSession.mockResolvedValueOnce({ user: { id: "user-1", role: "USER" } });
            prisma.customField.create.mockResolvedValueOnce({ id: "field-1", name: "test" });

            const request = {
                json: vi.fn().mockResolvedValueOnce({
                    name: "test",
                    label: "Test",
                    type: "STRING",
                }),
            };
            const response = await POST(request);

            expect(response.status).toBe(201);
        });

        it("allows API role to create fields", async () => {
            getServerSession.mockResolvedValueOnce({ user: { id: "user-1", role: "API" } });
            prisma.customField.create.mockResolvedValueOnce({ id: "field-1", name: "test" });

            const request = {
                json: vi.fn().mockResolvedValueOnce({
                    name: "test",
                    label: "Test",
                    type: "STRING",
                }),
            };
            const response = await POST(request);

            expect(response.status).toBe(201);
        });

        it("sets default values for optional fields", async () => {
            getServerSession.mockResolvedValueOnce({ user: { id: "user-1", role: "ADMIN" } });
            
            prisma.customField.create.mockImplementationOnce(async ({ data }) => ({
                id: "field-1",
                ...data,
                itemType: null,
            }));

            const request = {
                json: vi.fn().mockResolvedValueOnce({
                    name: "notes",
                    label: "Notes",
                    type: "STRING",
                    // required, defaultValue, options not provided
                }),
            };
            const response = await POST(request);

            expect(prisma.customField.create).toHaveBeenCalledWith({
                data: expect.objectContaining({
                    required: false,
                    defaultValue: undefined,
                    options: [],
                    itemTypeId: null,
                }),
                include: { itemType: true },
            });
        });

        it("returns 500 for unexpected errors", async () => {
            getServerSession.mockResolvedValueOnce({ user: { id: "user-1", role: "ADMIN" } });
            prisma.customField.create.mockRejectedValueOnce(new Error("Unexpected error"));

            const request = {
                json: vi.fn().mockResolvedValueOnce({
                    name: "test",
                    label: "Test",
                    type: "STRING",
                }),
            };
            const response = await POST(request);
            const data = await response.json();

            expect(response.status).toBe(500);
            expect(data.error).toBe("Failed to create custom field");
        });
    });
});
