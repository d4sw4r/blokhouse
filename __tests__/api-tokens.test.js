import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
    default: {
        apiToken: {
            findMany: vi.fn(),
            findUnique: vi.fn(),
            create: vi.fn(),
            delete: vi.fn(),
            update: vi.fn(),
        },
    },
}));
vi.mock("next-auth/next", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/authOptions", () => ({ default: {} }));
vi.mock("@/lib/audit", () => ({ logTokenCreated: vi.fn(), logTokenDeleted: vi.fn() }));

import { GET, POST } from "../app/api/api-tokens/route.js";
import { DELETE } from "../app/api/api-tokens/[id]/route.js";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { logTokenCreated, logTokenDeleted } from "@/lib/audit";
import { hashToken } from "@/lib/auth";

function req(url = "http://localhost:3000/api/api-tokens", { body, headers = {} } = {}) {
    return new Request(url, {
        method: body === undefined ? "GET" : "POST",
        headers: { "content-type": "application/json", ...headers },
        body: body === undefined ? undefined : JSON.stringify(body),
    });
}
const params = (id) => ({ params: Promise.resolve({ id }) });
const asUser = (role = "USER", id = "user-1") =>
    getServerSession.mockResolvedValue({ user: { id, role, email: `${id}@x.io` } });

describe("API Tokens API", () => {
    beforeEach(() => vi.resetAllMocks());

    describe("GET /api/api-tokens", () => {
        it("returns 401 when not authenticated", async () => {
            getServerSession.mockResolvedValue(null);
            const res = await GET(req());
            expect(res.status).toBe(401);
        });

        it("lists only the caller's own tokens and never exposes secrets", async () => {
            asUser("USER");
            prisma.apiToken.findMany.mockResolvedValue([
                { id: "t1", name: "ansible", prefix: "bh_abcdef0", scopes: "read", createdAt: "2026-01-01" },
            ]);

            const res = await GET(req());
            const data = await res.json();

            expect(res.status).toBe(200);
            const args = prisma.apiToken.findMany.mock.calls[0][0];
            expect(args.where).toEqual({ userId: "user-1" });
            expect(args.select.tokenHash).toBeUndefined();
            expect(args.select.token).toBeUndefined();
            expect(data[0].scopes).toEqual(["read"]);
        });

        it("ignores ?all=true for non-admins", async () => {
            asUser("USER");
            prisma.apiToken.findMany.mockResolvedValue([]);
            await GET(req("http://localhost:3000/api/api-tokens?all=true"));
            expect(prisma.apiToken.findMany.mock.calls[0][0].where).toEqual({ userId: "user-1" });
        });

        it("lets admins list all tokens with ?all=true", async () => {
            asUser("ADMIN");
            prisma.apiToken.findMany.mockResolvedValue([]);
            await GET(req("http://localhost:3000/api/api-tokens?all=true"));
            expect(prisma.apiToken.findMany.mock.calls[0][0].where).toEqual({});
        });

        it("rejects token management with an API token", async () => {
            prisma.apiToken.findUnique.mockResolvedValue({
                id: "t1", scopes: "read,write,admin", user: { id: "user-1", role: "ADMIN" },
            });
            const res = await GET(req(undefined, { headers: { authorization: "Bearer bh_x" } }));
            expect(res.status).toBe(403);
            expect(prisma.apiToken.findMany).not.toHaveBeenCalled();
        });
    });

    describe("POST /api/api-tokens", () => {
        it("returns 401 when not authenticated", async () => {
            getServerSession.mockResolvedValue(null);
            const res = await POST(req(undefined, { body: {} }));
            expect(res.status).toBe(401);
        });

        it("creates a token, stores only its hash and returns the secret once", async () => {
            asUser("USER");
            prisma.apiToken.create.mockImplementation(async ({ data }) => ({
                id: "t1", name: data.name, prefix: data.prefix, scopes: data.scopes,
                expiresAt: data.expiresAt, lastUsedAt: null, createdAt: new Date(), userId: data.userId,
            }));

            const res = await POST(req(undefined, { body: { name: "ansible", scopes: ["read", "write"], expiresInDays: 30 } }));
            const data = await res.json();

            expect(res.status).toBe(201);
            expect(data.token).toMatch(/^bh_[0-9a-f]{64}$/);
            const stored = prisma.apiToken.create.mock.calls[0][0].data;
            expect(stored.tokenHash).toBe(hashToken(data.token));
            expect(stored.token).toBeUndefined();
            expect(stored.prefix).toBe(data.token.slice(0, 10));
            expect(stored.scopes).toBe("read,write");
            expect(stored.userId).toBe("user-1");
            expect(new Date(stored.expiresAt).getTime()).toBeGreaterThan(Date.now() + 29 * 86400e3);
            expect(logTokenCreated).toHaveBeenCalled();
        });

        it("defaults to a read-only token", async () => {
            asUser("USER");
            prisma.apiToken.create.mockImplementation(async ({ data }) => ({ id: "t1", ...data }));
            await POST(req(undefined, { body: {} }));
            expect(prisma.apiToken.create.mock.calls[0][0].data.scopes).toBe("read");
        });

        it("rejects scopes that exceed the user's role", async () => {
            asUser("USER");
            const res = await POST(req(undefined, { body: { scopes: ["read", "admin"] } }));
            expect(res.status).toBe(403);
            expect(prisma.apiToken.create).not.toHaveBeenCalled();
        });

        it("rejects unknown scopes", async () => {
            asUser("ADMIN");
            const res = await POST(req(undefined, { body: { scopes: ["root"] } }));
            expect(res.status).toBe(400);
        });

        it("rejects invalid expiry", async () => {
            asUser("USER");
            const res = await POST(req(undefined, { body: { expiresInDays: -1 } }));
            expect(res.status).toBe(400);
        });

        it("returns 500 when the database fails", async () => {
            asUser("USER");
            prisma.apiToken.create.mockRejectedValue(new Error("DB"));
            const res = await POST(req(undefined, { body: {} }));
            expect(res.status).toBe(500);
        });
    });

    describe("DELETE /api/api-tokens/[id]", () => {
        it("returns 401 when not authenticated", async () => {
            getServerSession.mockResolvedValue(null);
            const res = await DELETE(req(), params("t1"));
            expect(res.status).toBe(401);
        });

        it("deletes the caller's own token", async () => {
            asUser("USER");
            prisma.apiToken.findUnique.mockResolvedValue({ id: "t1", userId: "user-1" });
            prisma.apiToken.delete.mockResolvedValue({});
            const res = await DELETE(req(), params("t1"));
            expect(res.status).toBe(200);
            expect(prisma.apiToken.delete).toHaveBeenCalledWith({ where: { id: "t1" } });
            expect(logTokenDeleted).toHaveBeenCalled();
        });

        it("returns 404 for someone else's token", async () => {
            asUser("USER");
            prisma.apiToken.findUnique.mockResolvedValue({ id: "t1", userId: "other" });
            const res = await DELETE(req(), params("t1"));
            expect(res.status).toBe(404);
            expect(prisma.apiToken.delete).not.toHaveBeenCalled();
        });

        it("lets admins revoke any token", async () => {
            asUser("ADMIN", "admin-1");
            prisma.apiToken.findUnique.mockResolvedValue({ id: "t1", userId: "other" });
            prisma.apiToken.delete.mockResolvedValue({});
            const res = await DELETE(req(), params("t1"));
            expect(res.status).toBe(200);
        });

        it("returns 404 for a missing token", async () => {
            asUser("USER");
            prisma.apiToken.findUnique.mockResolvedValue(null);
            const res = await DELETE(req(), params("nope"));
            expect(res.status).toBe(404);
        });
    });
});
