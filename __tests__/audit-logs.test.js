import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { GET } from "../app/api/audit-logs/route.js";

// Mock prisma
vi.mock("@/lib/prisma", () => ({
    default: {
        auditLog: {
            count: vi.fn(),
            findMany: vi.fn(),
        },
    },
}));

// Mock next-auth
vi.mock("next-auth/next", () => ({
    getServerSession: vi.fn(),
}));

import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth/next";

describe("Audit Logs API", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.resetAllMocks();
    });

    describe("Authentication & Authorization", () => {
        it("returns 401 when not authenticated", async () => {
            getServerSession.mockResolvedValueOnce(null);

            const request = { url: "http://localhost:3000/api/audit-logs" };
            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(401);
            expect(data.error).toBe("Unauthorized");
        });

        it("returns 403 for USER role", async () => {
            getServerSession.mockResolvedValueOnce({ user: { id: "user-1", role: "USER" } });

            const request = { url: "http://localhost:3000/api/audit-logs" };
            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(403);
            expect(data.error).toContain("Admin or Audit role required");
        });

        it("returns 403 for API role", async () => {
            getServerSession.mockResolvedValueOnce({ user: { id: "user-1", role: "API" } });

            const request = { url: "http://localhost:3000/api/audit-logs" };
            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(403);
        });

        it("allows ADMIN role to view audit logs", async () => {
            getServerSession.mockResolvedValueOnce({ user: { id: "user-1", role: "ADMIN" } });
            prisma.auditLog.count.mockResolvedValueOnce(0);
            prisma.auditLog.findMany.mockResolvedValueOnce([]);

            const request = { url: "http://localhost:3000/api/audit-logs" };
            const response = await GET(request);

            expect(response.status).toBe(200);
        });

        it("allows AUDIT role to view audit logs", async () => {
            getServerSession.mockResolvedValueOnce({ user: { id: "user-1", role: "AUDIT" } });
            prisma.auditLog.count.mockResolvedValueOnce(0);
            prisma.auditLog.findMany.mockResolvedValueOnce([]);

            const request = { url: "http://localhost:3000/api/audit-logs" };
            const response = await GET(request);

            expect(response.status).toBe(200);
        });
    });

    describe("Basic querying", () => {
        beforeEach(() => {
            getServerSession.mockResolvedValue({ user: { id: "user-1", role: "ADMIN" } });
        });

        it("returns audit logs with pagination", async () => {
            const mockLogs = [
                {
                    id: "log-1",
                    action: "CREATE",
                    entityType: "ConfigurationItem",
                    entityId: "item-1",
                    userId: "user-1",
                    description: "Created item",
                    createdAt: "2026-02-22T00:00:00Z",
                    user: { id: "user-1", name: "Admin", email: "admin@example.com" },
                },
            ];
            prisma.auditLog.count.mockResolvedValueOnce(1);
            prisma.auditLog.findMany.mockResolvedValueOnce(mockLogs);

            const request = { url: "http://localhost:3000/api/audit-logs" };
            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.logs).toHaveLength(1);
            expect(data.pagination).toMatchObject({
                total: 1,
                page: 1,
                limit: 50,
                totalPages: 1,
            });
        });

        it("returns empty array when no logs exist", async () => {
            prisma.auditLog.count.mockResolvedValueOnce(0);
            prisma.auditLog.findMany.mockResolvedValueOnce([]);

            const request = { url: "http://localhost:3000/api/audit-logs" };
            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.logs).toEqual([]);
            expect(data.pagination.total).toBe(0);
        });

        it("includes user information in logs", async () => {
            const mockLogs = [
                {
                    id: "log-1",
                    action: "CREATE",
                    entityType: "ConfigurationItem",
                    user: { id: "user-1", name: "John Doe", email: "john@example.com" },
                },
            ];
            prisma.auditLog.count.mockResolvedValueOnce(1);
            prisma.auditLog.findMany.mockResolvedValueOnce(mockLogs);

            const request = { url: "http://localhost:3000/api/audit-logs" };
            const response = await GET(request);
            const data = await response.json();

            expect(data.logs[0].user).toBeDefined();
            expect(data.logs[0].user.name).toBe("John Doe");
        });

        it("orders logs by createdAt desc", async () => {
            prisma.auditLog.count.mockResolvedValueOnce(0);
            prisma.auditLog.findMany.mockResolvedValueOnce([]);

            const request = { url: "http://localhost:3000/api/audit-logs" };
            await GET(request);

            expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    orderBy: { createdAt: "desc" },
                })
            );
        });
    });

    describe("Filtering", () => {
        beforeEach(() => {
            getServerSession.mockResolvedValue({ user: { id: "user-1", role: "ADMIN" } });
        });

        it("filters by action type", async () => {
            prisma.auditLog.count.mockResolvedValueOnce(5);
            prisma.auditLog.findMany.mockResolvedValueOnce([]);

            const request = { url: "http://localhost:3000/api/audit-logs?action=CREATE" };
            await GET(request);

            expect(prisma.auditLog.count).toHaveBeenCalledWith({
                where: { action: "CREATE" },
            });
            expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { action: "CREATE" },
                })
            );
        });

        it("filters by entityType", async () => {
            prisma.auditLog.count.mockResolvedValueOnce(3);
            prisma.auditLog.findMany.mockResolvedValueOnce([]);

            const request = { url: "http://localhost:3000/api/audit-logs?entityType=ConfigurationItem" };
            await GET(request);

            expect(prisma.auditLog.count).toHaveBeenCalledWith({
                where: { entityType: "ConfigurationItem" },
            });
        });

        it("filters by entityId", async () => {
            prisma.auditLog.count.mockResolvedValueOnce(2);
            prisma.auditLog.findMany.mockResolvedValueOnce([]);

            const request = { url: "http://localhost:3000/api/audit-logs?entityId=item-123" };
            await GET(request);

            expect(prisma.auditLog.count).toHaveBeenCalledWith({
                where: { entityId: "item-123" },
            });
        });

        it("filters by userId", async () => {
            prisma.auditLog.count.mockResolvedValueOnce(10);
            prisma.auditLog.findMany.mockResolvedValueOnce([]);

            const request = { url: "http://localhost:3000/api/audit-logs?userId=user-456" };
            await GET(request);

            expect(prisma.auditLog.count).toHaveBeenCalledWith({
                where: { userId: "user-456" },
            });
        });

        it("combines multiple filters", async () => {
            prisma.auditLog.count.mockResolvedValueOnce(1);
            prisma.auditLog.findMany.mockResolvedValueOnce([]);

            const request = { url: "http://localhost:3000/api/audit-logs?action=CREATE&entityType=ConfigurationItem&userId=user-1" };
            await GET(request);

            expect(prisma.auditLog.count).toHaveBeenCalledWith({
                where: {
                    action: "CREATE",
                    entityType: "ConfigurationItem",
                    userId: "user-1",
                },
            });
        });
    });

    describe("Pagination", () => {
        beforeEach(() => {
            getServerSession.mockResolvedValue({ user: { id: "user-1", role: "ADMIN" } });
        });

        it("uses default page and limit", async () => {
            prisma.auditLog.count.mockResolvedValueOnce(100);
            prisma.auditLog.findMany.mockResolvedValueOnce([]);

            const request = { url: "http://localhost:3000/api/audit-logs" };
            const response = await GET(request);
            const data = await response.json();

            expect(data.pagination.page).toBe(1);
            expect(data.pagination.limit).toBe(50);
            expect(data.pagination.totalPages).toBe(2);
        });

        it("accepts custom page parameter", async () => {
            prisma.auditLog.count.mockResolvedValueOnce(100);
            prisma.auditLog.findMany.mockResolvedValueOnce([]);

            const request = { url: "http://localhost:3000/api/audit-logs?page=2" };
            const response = await GET(request);
            const data = await response.json();

            expect(data.pagination.page).toBe(2);
            expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    skip: 50, // (2-1) * 50
                    take: 50,
                })
            );
        });

        it("accepts custom limit parameter", async () => {
            prisma.auditLog.count.mockResolvedValueOnce(100);
            prisma.auditLog.findMany.mockResolvedValueOnce([]);

            const request = { url: "http://localhost:3000/api/audit-logs?limit=25" };
            const response = await GET(request);
            const data = await response.json();

            expect(data.pagination.limit).toBe(25);
            expect(data.pagination.totalPages).toBe(4);
        });

        it("calculates totalPages correctly", async () => {
            prisma.auditLog.count.mockResolvedValueOnce(55);
            prisma.auditLog.findMany.mockResolvedValueOnce([]);

            const request = { url: "http://localhost:3000/api/audit-logs?limit=10" };
            const response = await GET(request);
            const data = await response.json();

            expect(data.pagination.totalPages).toBe(6); // ceil(55/10)
        });
    });

    describe("Error handling", () => {
        it("returns 500 when database query fails", async () => {
            getServerSession.mockResolvedValueOnce({ user: { id: "user-1", role: "ADMIN" } });
            prisma.auditLog.count.mockRejectedValueOnce(new Error("Database error"));

            const request = { url: "http://localhost:3000/api/audit-logs" };
            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(500);
            expect(data.error).toBe("Failed to fetch audit logs");
        });

        it("returns 500 when findMany fails", async () => {
            getServerSession.mockResolvedValueOnce({ user: { id: "user-1", role: "ADMIN" } });
            prisma.auditLog.count.mockResolvedValueOnce(10);
            prisma.auditLog.findMany.mockRejectedValueOnce(new Error("Query failed"));

            const request = { url: "http://localhost:3000/api/audit-logs" };
            const response = await GET(request);

            expect(response.status).toBe(500);
        });
    });

    describe("Response format", () => {
        beforeEach(() => {
            getServerSession.mockResolvedValue({ user: { id: "user-1", role: "ADMIN" } });
        });

        it("returns correct content type header", async () => {
            prisma.auditLog.count.mockResolvedValueOnce(0);
            prisma.auditLog.findMany.mockResolvedValueOnce([]);

            const request = { url: "http://localhost:3000/api/audit-logs" };
            const response = await GET(request);

            expect(response.headers.get("Content-Type")).toBe("application/json");
        });

        it("returns all audit log fields", async () => {
            const mockLogs = [
                {
                    id: "log-1",
                    action: "CREATE",
                    entityType: "ConfigurationItem",
                    entityId: "item-1",
                    userId: "user-1",
                    description: "Created configuration item",
                    oldValues: null,
                    newValues: { name: "Server 1", status: "ACTIVE" },
                    ipAddress: "192.168.1.1",
                    userAgent: "Mozilla/5.0",
                    createdAt: "2026-02-22T00:00:00Z",
                    user: { id: "user-1", name: "Admin", email: "admin@example.com" },
                },
            ];
            prisma.auditLog.count.mockResolvedValueOnce(1);
            prisma.auditLog.findMany.mockResolvedValueOnce(mockLogs);

            const request = { url: "http://localhost:3000/api/audit-logs" };
            const response = await GET(request);
            const data = await response.json();

            const log = data.logs[0];
            expect(log).toHaveProperty("id");
            expect(log).toHaveProperty("action");
            expect(log).toHaveProperty("entityType");
            expect(log).toHaveProperty("entityId");
            expect(log).toHaveProperty("userId");
            expect(log).toHaveProperty("description");
            expect(log).toHaveProperty("oldValues");
            expect(log).toHaveProperty("newValues");
            expect(log).toHaveProperty("ipAddress");
            expect(log).toHaveProperty("userAgent");
            expect(log).toHaveProperty("createdAt");
            expect(log).toHaveProperty("user");
        });
    });
});
