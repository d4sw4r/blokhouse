import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock prisma before importing the route
vi.mock("@/lib/prisma", () => ({
    default: {
        apiToken: {
            findUnique: vi.fn(),
        },
    },
}));

import { GET } from "../app/api/validate-token/route.js";
import prisma from "@/lib/prisma";

describe("Validate-Token API", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    function makeRequest(token) {
        const url = token
            ? `http://localhost:3000/api/validate-token?token=${encodeURIComponent(token)}`
            : "http://localhost:3000/api/validate-token";
        return { url };
    }

    // ─── Missing token ─────────────────────────────────────────────────────────

    describe("missing token parameter", () => {
        it("returns 400 with valid=false when no token query param", async () => {
            const res  = await GET(makeRequest(null));
            const data = await res.json();

            expect(res.status).toBe(400);
            expect(data.valid).toBe(false);
            expect(prisma.apiToken.findUnique).not.toHaveBeenCalled();
        });

        it("returns 400 for empty token string", async () => {
            const res  = await GET(makeRequest(""));
            const data = await res.json();

            // empty string is falsy → same branch
            expect(res.status).toBe(400);
            expect(data.valid).toBe(false);
        });
    });

    // ─── Valid token ───────────────────────────────────────────────────────────

    describe("valid token", () => {
        it("returns 200 with valid=true when token exists in DB", async () => {
            prisma.apiToken.findUnique.mockResolvedValue({
                id: "tok1",
                token: "abc123",
                userId: "u1",
            });

            const res  = await GET(makeRequest("abc123"));
            const data = await res.json();

            expect(res.status).toBe(200);
            expect(data.valid).toBe(true);
        });

        it("looks up the correct token in prisma", async () => {
            prisma.apiToken.findUnique.mockResolvedValue({ id: "tok1", token: "mytoken" });

            await GET(makeRequest("mytoken"));

            expect(prisma.apiToken.findUnique).toHaveBeenCalledWith({
                where: { token: "mytoken" },
            });
        });

        it("handles tokens with special characters", async () => {
            const specialToken = "tok+en/with=special&chars";
            prisma.apiToken.findUnique.mockResolvedValue({ id: "tok2", token: specialToken });

            const res  = await GET(makeRequest(specialToken));
            const data = await res.json();

            expect(res.status).toBe(200);
            expect(data.valid).toBe(true);
        });
    });

    // ─── Invalid / unknown token ───────────────────────────────────────────────

    describe("invalid / unknown token", () => {
        it("returns 200 with valid=false when token not found", async () => {
            prisma.apiToken.findUnique.mockResolvedValue(null);

            const res  = await GET(makeRequest("notexisting"));
            const data = await res.json();

            expect(res.status).toBe(200);
            expect(data.valid).toBe(false);
        });

        it("returns valid=false for a random UUID that is not in DB", async () => {
            prisma.apiToken.findUnique.mockResolvedValue(null);

            const res  = await GET(makeRequest("00000000-0000-0000-0000-000000000000"));
            const data = await res.json();

            expect(data.valid).toBe(false);
        });
    });

    // ─── Database errors ───────────────────────────────────────────────────────

    describe("database errors", () => {
        it("returns 500 with valid=false when prisma throws", async () => {
            prisma.apiToken.findUnique.mockRejectedValue(new Error("DB connection lost"));

            const res  = await GET(makeRequest("sometoken"));
            const data = await res.json();

            expect(res.status).toBe(500);
            expect(data.valid).toBe(false);
            expect(data.error).toBeDefined();
        });

        it("includes error message in 500 response", async () => {
            prisma.apiToken.findUnique.mockRejectedValue(new Error("Timeout"));

            const res  = await GET(makeRequest("tok"));
            const data = await res.json();

            expect(data.error).toBe("Timeout");
        });
    });
});
