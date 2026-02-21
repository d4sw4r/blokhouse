import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { GET } from "../app/api/health/route.js";

// Mock prisma
vi.mock("@/lib/prisma", () => ({
    default: {
        $queryRaw: vi.fn(),
    },
}));

import prisma from "@/lib/prisma";

describe("Health Check API", () => {
    let request;

    beforeEach(() => {
        request = {
            url: "http://localhost:3000/api/health",
        };
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe("Basic health check", () => {
        it("returns healthy status when database is connected", async () => {
            prisma.$queryRaw.mockResolvedValueOnce([{ 1: 1 }]);

            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.status).toBe("healthy");
            expect(data.checks.database.status).toBe("healthy");
            expect(data.checks.database.responseTime).toBeGreaterThanOrEqual(0);
            expect(data.timestamp).toBeDefined();
            expect(data.uptime).toBeGreaterThanOrEqual(0);
            expect(data.responseTime).toBeGreaterThanOrEqual(0);
        });

        it("returns unhealthy status when database connection fails", async () => {
            prisma.$queryRaw.mockRejectedValueOnce(new Error("Connection failed"));

            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(503);
            expect(data.status).toBe("unhealthy");
            expect(data.checks.database.status).toBe("unhealthy");
            expect(data.checks.database.error).toBe("Database connection failed");
        });

        it("returns correct content type headers", async () => {
            prisma.$queryRaw.mockResolvedValueOnce([{ 1: 1 }]);

            const response = await GET(request);

            expect(response.headers.get("Content-Type")).toBe("application/json");
            expect(response.headers.get("Cache-Control")).toContain("no-cache");
        });
    });

    describe("Detailed health check", () => {
        it("includes system metrics when detailed=true", async () => {
            prisma.$queryRaw.mockResolvedValueOnce([{ 1: 1 }]);
            request.url = "http://localhost:3000/api/health?detailed=true";

            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.system).toBeDefined();
            expect(data.system.nodeVersion).toBeDefined();
            expect(data.system.platform).toBeDefined();
            expect(data.system.memory).toBeDefined();
            expect(data.system.memory.heapUsed).toBeGreaterThanOrEqual(0);
            expect(data.system.memory.heapTotal).toBeGreaterThanOrEqual(0);
            expect(data.system.memory.rss).toBeGreaterThanOrEqual(0);
        });

        it("excludes system metrics when detailed=false", async () => {
            prisma.$queryRaw.mockResolvedValueOnce([{ 1: 1 }]);
            request.url = "http://localhost:3000/api/health?detailed=false";

            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.system).toBeUndefined();
        });

        it("excludes system metrics when detailed parameter is missing", async () => {
            prisma.$queryRaw.mockResolvedValueOnce([{ 1: 1 }]);

            const response = await GET(request);
            const data = await response.json();

            expect(data.system).toBeUndefined();
        });
    });

    describe("Response structure", () => {
        it("returns all required fields in the response", async () => {
            prisma.$queryRaw.mockResolvedValueOnce([{ 1: 1 }]);

            const response = await GET(request);
            const data = await response.json();

            expect(data).toHaveProperty("status");
            expect(data).toHaveProperty("timestamp");
            expect(data).toHaveProperty("uptime");
            expect(data).toHaveProperty("checks");
            expect(data).toHaveProperty("responseTime");
            expect(data.checks).toHaveProperty("database");
        });

        it("returns ISO 8601 formatted timestamp", async () => {
            prisma.$queryRaw.mockResolvedValueOnce([{ 1: 1 }]);

            const response = await GET(request);
            const data = await response.json();

            // ISO 8601 regex
            const iso8601Regex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
            expect(data.timestamp).toMatch(iso8601Regex);
        });

        it("returns uptime as a non-negative integer", async () => {
            prisma.$queryRaw.mockResolvedValueOnce([{ 1: 1 }]);

            const response = await GET(request);
            const data = await response.json();

            expect(Number.isInteger(data.uptime)).toBe(true);
            expect(data.uptime).toBeGreaterThanOrEqual(0);
        });
    });
});
