import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock prisma before importing the route
vi.mock("@/lib/prisma", () => ({
    default: {
        apiToken: {
            findMany: vi.fn(),
            create: vi.fn(),
            delete: vi.fn(),
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

// Mock audit logging
vi.mock("@/lib/audit", () => ({
    logTokenCreated: vi.fn(),
    logTokenDeleted: vi.fn(),
}));

// Mock crypto with default export
vi.mock("crypto", () => ({
    default: {
        randomBytes: vi.fn(() => ({
            toString: vi.fn(() => "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890"),
        })),
    },
    randomBytes: vi.fn(() => ({
        toString: vi.fn(() => "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890"),
    })),
}));

import { GET, POST } from "../app/api/api-tokens/route.js";
import { DELETE } from "../app/api/api-tokens/[id]/route.js";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { logTokenCreated, logTokenDeleted } from "@/lib/audit";
import crypto from "crypto";

describe("API Tokens API", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    // Helper to create mock request
    function createMockRequest() {
        return {
            headers: {
                get: vi.fn(),
            },
        };
    }

    describe("GET /api/api-tokens", () => {
        it("returns 401 when not authenticated", async () => {
            getServerSession.mockResolvedValue(null);

            const response = await GET();
            const data = await response.json();

            expect(response.status).toBe(401);
            expect(data.error).toBe("Unauthorized");
        });

        it("returns all API tokens for authenticated user", async () => {
            getServerSession.mockResolvedValue({ user: { id: "user-1", role: "USER" } });

            const mockTokens = [
                { id: "token-1", token: "abc123...", createdAt: "2024-01-01T00:00:00Z" },
                { id: "token-2", token: "def456...", createdAt: "2024-01-02T00:00:00Z" },
            ];
            prisma.apiToken.findMany.mockResolvedValue(mockTokens);

            const response = await GET();
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data).toHaveLength(2);
            expect(data[0].id).toBe("token-1");
            expect(data[1].id).toBe("token-2");
        });

        it("returns empty array when no tokens exist", async () => {
            getServerSession.mockResolvedValue({ user: { id: "user-1", role: "USER" } });
            prisma.apiToken.findMany.mockResolvedValue([]);

            const response = await GET();
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data).toEqual([]);
        });

        it("queries with correct select options", async () => {
            getServerSession.mockResolvedValue({ user: { id: "user-1", role: "USER" } });
            prisma.apiToken.findMany.mockResolvedValue([]);

            await GET();

            expect(prisma.apiToken.findMany).toHaveBeenCalledWith({
                select: { id: true, token: true, createdAt: true },
            });
        });

        it("allows ADMIN role to list tokens", async () => {
            getServerSession.mockResolvedValue({ user: { id: "admin-1", role: "ADMIN" } });
            prisma.apiToken.findMany.mockResolvedValue([]);

            const response = await GET();

            expect(response.status).toBe(200);
        });
    });

    describe("POST /api/api-tokens", () => {
        it("returns 401 when not authenticated", async () => {
            getServerSession.mockResolvedValue(null);
            const request = createMockRequest();

            const response = await POST(request);
            const data = await response.json();

            expect(response.status).toBe(401);
            expect(data.error).toBe("Unauthorized");
        });

        it("creates a new API token with generated value", async () => {
            getServerSession.mockResolvedValue({ user: { id: "user-1", role: "USER" } });

            const createdToken = {
                id: "token-new",
                token: "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
                createdAt: "2024-01-01T00:00:00Z",
            };
            prisma.apiToken.create.mockResolvedValue(createdToken);

            const request = createMockRequest();
            const response = await POST(request);
            const data = await response.json();

            expect(response.status).toBe(201);
            expect(data.token).toBe("abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890");
            expect(data.id).toBe("token-new");
        });

        it("associates token with current user", async () => {
            getServerSession.mockResolvedValue({ user: { id: "user-1", role: "USER" } });

            const createdToken = {
                id: "token-new",
                token: "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
                createdAt: "2024-01-01T00:00:00Z",
            };
            prisma.apiToken.create.mockResolvedValue(createdToken);

            const request = createMockRequest();
            await POST(request);

            expect(prisma.apiToken.create).toHaveBeenCalledWith({
                data: {
                    token: "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
                    userId: "user-1",
                },
                select: { id: true, token: true, createdAt: true },
            });
        });

        it("logs token creation via audit", async () => {
            getServerSession.mockResolvedValue({ user: { id: "user-1", role: "USER" } });

            const createdToken = {
                id: "token-new",
                token: "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
                createdAt: "2024-01-01T00:00:00Z",
            };
            prisma.apiToken.create.mockResolvedValue(createdToken);

            const request = createMockRequest();
            await POST(request);

            expect(logTokenCreated).toHaveBeenCalledWith({
                token: createdToken,
                userId: "user-1",
                req: request,
            });
        });

        it("handles database errors gracefully", async () => {
            getServerSession.mockResolvedValue({ user: { id: "user-1", role: "USER" } });
            prisma.apiToken.create.mockRejectedValue(new Error("DB Error"));

            const request = createMockRequest();
            const response = await POST(request);
            const data = await response.json();

            expect(response.status).toBe(500);
            expect(data.error).toBe("Could not create token");
        });

        it("allows ADMIN role to create tokens", async () => {
            getServerSession.mockResolvedValue({ user: { id: "admin-1", role: "ADMIN" } });

            const createdToken = {
                id: "token-admin",
                token: "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
                createdAt: "2024-01-01T00:00:00Z",
            };
            prisma.apiToken.create.mockResolvedValue(createdToken);

            const request = createMockRequest();
            const response = await POST(request);

            expect(response.status).toBe(201);
        });

        it("generates a 64-character hex token", async () => {
            getServerSession.mockResolvedValue({ user: { id: "user-1", role: "USER" } });

            prisma.apiToken.create.mockResolvedValue({
                id: "token-new",
                token: "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
                createdAt: "2024-01-01T00:00:00Z",
            });

            const request = createMockRequest();
            await POST(request);

            // crypto.randomBytes(32) creates 64 hex characters
            expect(prisma.apiToken.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        token: expect.stringMatching(/^[a-f0-9]{64}$/),
                    }),
                })
            );
        });
    });

    describe("DELETE /api/api-tokens/[id]", () => {
        it("returns 401 when not authenticated", async () => {
            getServerSession.mockResolvedValue(null);
            const request = createMockRequest();

            const response = await DELETE(request, { params: Promise.resolve({ id: "token-1" }) });
            const data = await response.json();

            expect(response.status).toBe(401);
            expect(data.error).toBe("Unauthorized");
        });

        it("deletes token and returns success message", async () => {
            getServerSession.mockResolvedValue({ user: { id: "user-1", role: "USER" } });
            prisma.apiToken.delete.mockResolvedValue({ id: "token-1" });

            const request = createMockRequest();
            const response = await DELETE(request, { params: Promise.resolve({ id: "token-1" }) });
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.message).toBe("Deleted");
            expect(prisma.apiToken.delete).toHaveBeenCalledWith({ where: { id: "token-1" } });
        });

        it("logs token deletion via audit", async () => {
            getServerSession.mockResolvedValue({ user: { id: "user-1", role: "USER" } });
            prisma.apiToken.delete.mockResolvedValue({ id: "token-1" });

            const request = createMockRequest();
            await DELETE(request, { params: Promise.resolve({ id: "token-1" }) });

            expect(logTokenDeleted).toHaveBeenCalledWith({
                tokenId: "token-1",
                userId: "user-1",
                req: request,
            });
        });

        it("handles database errors gracefully", async () => {
            getServerSession.mockResolvedValue({ user: { id: "user-1", role: "USER" } });
            prisma.apiToken.delete.mockRejectedValue(new Error("DB Error"));

            const request = createMockRequest();
            const response = await DELETE(request, { params: Promise.resolve({ id: "token-1" }) });
            const data = await response.json();

            expect(response.status).toBe(500);
            expect(data.error).toBe("Delete failed");
        });

        it("handles deletion of non-existent token", async () => {
            getServerSession.mockResolvedValue({ user: { id: "user-1", role: "USER" } });

            const error = new Error("Record not found");
            prisma.apiToken.delete.mockRejectedValue(error);

            const request = createMockRequest();
            const response = await DELETE(request, { params: Promise.resolve({ id: "nonexistent" }) });
            const data = await response.json();

            expect(response.status).toBe(500);
            expect(data.error).toBe("Delete failed");
        });

        it("allows ADMIN role to delete tokens", async () => {
            getServerSession.mockResolvedValue({ user: { id: "admin-1", role: "ADMIN" } });
            prisma.apiToken.delete.mockResolvedValue({ id: "token-1" });

            const request = createMockRequest();
            const response = await DELETE(request, { params: Promise.resolve({ id: "token-1" }) });

            expect(response.status).toBe(200);
        });

        it("allows USER role to delete tokens", async () => {
            getServerSession.mockResolvedValue({ user: { id: "user-1", role: "USER" } });
            prisma.apiToken.delete.mockResolvedValue({ id: "token-1" });

            const request = createMockRequest();
            const response = await DELETE(request, { params: Promise.resolve({ id: "token-1" }) });

            expect(response.status).toBe(200);
        });
    });
});
