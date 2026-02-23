import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock prisma before importing the route
vi.mock("@/lib/prisma", () => ({
    default: {
        configurationItem: {
            createMany: vi.fn(),
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

// Mock csv-parser lib
vi.mock("@/lib/csv-parser", () => ({
    parseCsv: vi.fn(),
}));

import { POST } from "../app/api/configuration-items/upload/route.js";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { parseCsv } from "@/lib/csv-parser";

describe("CSV Upload API (/api/configuration-items/upload)", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    function makeRequest(body = {}) {
        return {
            url: "http://localhost:3000/api/configuration-items/upload",
            headers: { get: vi.fn(() => null) },
            json: vi.fn().mockResolvedValue(body),
        };
    }

    // ─── Auth ──────────────────────────────────────────────────────────────────

    describe("authentication", () => {
        it("returns 401 when not authenticated", async () => {
            getServerSession.mockResolvedValue(null);

            const res  = await POST(makeRequest({ csv: "name\nServer1" }));
            const data = await res.json();

            expect(res.status).toBe(401);
            expect(data.error).toBe("Unauthorized");
            expect(parseCsv).not.toHaveBeenCalled();
        });
    });

    // ─── Happy path ────────────────────────────────────────────────────────────

    describe("successful upload", () => {
        beforeEach(() => {
            getServerSession.mockResolvedValue({ user: { id: "u1", name: "Alice" } });
        });

        it("inserts valid rows and returns 201 with count", async () => {
            parseCsv.mockReturnValue({
                items:   [{ name: "Server1", userId: "u1" }, { name: "Server2", userId: "u1" }],
                errors:  [],
                skipped: 0,
            });
            prisma.configurationItem.createMany.mockResolvedValue({ count: 2 });

            const res  = await POST(makeRequest({ csv: "name\nServer1\nServer2" }));
            const data = await res.json();

            expect(res.status).toBe(201);
            expect(data.inserted).toBe(2);
            expect(data.skipped).toBe(0);
            expect(data.message).toBe("CSV processed");
        });

        it("passes user ID from session to parseCsv", async () => {
            parseCsv.mockReturnValue({ items: [{ name: "S1" }], errors: [], skipped: 0 });
            prisma.configurationItem.createMany.mockResolvedValue({ count: 1 });

            await POST(makeRequest({ csv: "name\nS1" }));

            expect(parseCsv).toHaveBeenCalledWith("name\nS1", "u1");
        });

        it("includes errors array in response when some rows fail validation", async () => {
            parseCsv.mockReturnValue({
                items:   [{ name: "Good" }],
                errors:  ["Row 2: missing name"],
                skipped: 1,
            });
            prisma.configurationItem.createMany.mockResolvedValue({ count: 1 });

            const res  = await POST(makeRequest({ csv: "name\nGood\n" }));
            const data = await res.json();

            expect(res.status).toBe(201);
            expect(data.inserted).toBe(1);
            expect(data.skipped).toBe(1);
            expect(data.errors).toEqual(["Row 2: missing name"]);
        });

        it("omits errors key when all rows are valid", async () => {
            parseCsv.mockReturnValue({ items: [{ name: "S1" }], errors: [], skipped: 0 });
            prisma.configurationItem.createMany.mockResolvedValue({ count: 1 });

            const res  = await POST(makeRequest({ csv: "name\nS1" }));
            const data = await res.json();

            // errors should be undefined (omitted) when array is empty
            expect(data.errors).toBeUndefined();
        });

        it("calls prisma.configurationItem.createMany with parsed items", async () => {
            const items = [{ name: "A", userId: "u1" }, { name: "B", userId: "u1" }];
            parseCsv.mockReturnValue({ items, errors: [], skipped: 0 });
            prisma.configurationItem.createMany.mockResolvedValue({ count: 2 });

            await POST(makeRequest({ csv: "name\nA\nB" }));

            expect(prisma.configurationItem.createMany).toHaveBeenCalledWith({ data: items });
        });
    });

    // ─── All rows invalid ──────────────────────────────────────────────────────

    describe("all rows invalid", () => {
        beforeEach(() => {
            getServerSession.mockResolvedValue({ user: { id: "u1" } });
        });

        it("returns 400 when parseCsv returns zero valid items", async () => {
            parseCsv.mockReturnValue({
                items:   [],
                errors:  ["Row 1: missing name", "Row 2: missing name"],
                skipped: 2,
            });

            const res  = await POST(makeRequest({ csv: "name\n\n" }));
            const data = await res.json();

            expect(res.status).toBe(400);
            expect(data.error).toBe("No valid rows found");
            expect(data.details).toEqual(["Row 1: missing name", "Row 2: missing name"]);
            expect(prisma.configurationItem.createMany).not.toHaveBeenCalled();
        });

        it("returns 400 for completely empty CSV", async () => {
            parseCsv.mockReturnValue({ items: [], errors: ["Empty CSV"], skipped: 0 });

            const res  = await POST(makeRequest({ csv: "" }));
            const data = await res.json();

            expect(res.status).toBe(400);
            expect(data.error).toBe("No valid rows found");
        });
    });

    // ─── Prisma / server errors ────────────────────────────────────────────────

    describe("server errors", () => {
        beforeEach(() => {
            getServerSession.mockResolvedValue({ user: { id: "u1" } });
        });

        it("returns 500 when prisma.createMany throws", async () => {
            parseCsv.mockReturnValue({ items: [{ name: "S1" }], errors: [], skipped: 0 });
            prisma.configurationItem.createMany.mockRejectedValue(new Error("DB error"));

            const res  = await POST(makeRequest({ csv: "name\nS1" }));
            const data = await res.json();

            expect(res.status).toBe(500);
            expect(data.error).toBe("CSV processing failed");
            expect(data.details).toBe("DB error");
        });

        it("returns 500 when request.json() throws (malformed body)", async () => {
            getServerSession.mockResolvedValue({ user: { id: "u1" } });
            const badRequest = {
                url: "http://localhost:3000/api/configuration-items/upload",
                headers: { get: vi.fn(() => null) },
                json: vi.fn().mockRejectedValue(new Error("Unexpected token")),
            };

            const res  = await POST(badRequest);
            const data = await res.json();

            expect(res.status).toBe(500);
            expect(data.error).toBe("CSV processing failed");
        });
    });

    // ─── Large upload ──────────────────────────────────────────────────────────

    describe("large uploads", () => {
        beforeEach(() => {
            getServerSession.mockResolvedValue({ user: { id: "u1" } });
        });

        it("handles 500 rows correctly", async () => {
            const items = Array.from({ length: 500 }, (_, i) => ({ name: `Server${i}`, userId: "u1" }));
            parseCsv.mockReturnValue({ items, errors: [], skipped: 0 });
            prisma.configurationItem.createMany.mockResolvedValue({ count: 500 });

            const csv = "name\n" + items.map(i => i.name).join("\n");
            const res  = await POST(makeRequest({ csv }));
            const data = await res.json();

            expect(res.status).toBe(201);
            expect(data.inserted).toBe(500);
        });

        it("handles mixed valid/invalid rows at scale", async () => {
            const items = Array.from({ length: 300 }, (_, i) => ({ name: `S${i}` }));
            const errors = Array.from({ length: 200 }, (_, i) => `Row ${i + 301}: invalid`);
            parseCsv.mockReturnValue({ items, errors, skipped: 200 });
            prisma.configurationItem.createMany.mockResolvedValue({ count: 300 });

            const res  = await POST(makeRequest({ csv: "some\ncsv" }));
            const data = await res.json();

            expect(res.status).toBe(201);
            expect(data.inserted).toBe(300);
            expect(data.skipped).toBe(200);
            expect(data.errors).toHaveLength(200);
        });
    });
});
