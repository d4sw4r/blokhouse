import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
    default: { apiToken: { findUnique: vi.fn(), update: vi.fn() } },
}));
vi.mock("next-auth/next", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/authOptions", () => ({ default: {} }));

import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import {
    authenticate, requireAuth, hashToken, generateToken, parseScopes, scopesForRole, ROLES,
} from "@/lib/auth";

const bearer = (t) => new Request("http://x/api/x", { headers: { authorization: `Bearer ${t}` } });
const plain = () => new Request("http://x/api/x");

describe("lib/auth", () => {
    beforeEach(() => vi.resetAllMocks());

    it("generates prefixed, unique tokens and hashes them with SHA-256", () => {
        const a = generateToken();
        const b = generateToken();
        expect(a).toMatch(/^bh_[0-9a-f]{64}$/);
        expect(a).not.toBe(b);
        expect(hashToken("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
    });

    it("maps every role to scopes", () => {
        for (const r of ROLES) expect(scopesForRole(r).length).toBeGreaterThan(0);
        expect(scopesForRole("ADMIN")).toContain("admin");
        expect(scopesForRole("USER")).not.toContain("admin");
        expect(scopesForRole("READONLY")).toEqual(["read"]);
        expect(scopesForRole("UNKNOWN")).toEqual([]);
        expect(scopesForRole(undefined)).toEqual([]);
    });

    it("parses scopes", () => {
        expect(parseScopes(["read", "write", "read"]).scopes).toEqual(["read", "write"]);
        expect(parseScopes("read, audit").scopes).toEqual(["read", "audit"]);
        expect(parseScopes([]).scopes).toEqual(["read"]);
        expect(parseScopes(["sudo"]).error).toMatch(/Invalid scope/);
    });

    it("authenticates sessions with role scopes", async () => {
        getServerSession.mockResolvedValue({ user: { id: "u1", role: "USER" } });
        const auth = await authenticate(plain());
        expect(auth.via).toBe("session");
        expect(auth.scopes).toEqual(["read", "write"]);
    });

    it("looks tokens up by hash and intersects scopes with the owner's role", async () => {
        prisma.apiToken.findUnique.mockResolvedValue({
            id: "t1", scopes: "read,write,admin", user: { id: "u1", role: "USER" },
        });
        prisma.apiToken.update.mockResolvedValue({});
        const auth = await authenticate(bearer("bh_secret"));
        expect(prisma.apiToken.findUnique.mock.calls[0][0].where).toEqual({ tokenHash: hashToken("bh_secret") });
        expect(auth.via).toBe("token");
        expect(auth.scopes).toEqual(["read", "write"]);
        expect(prisma.apiToken.update).toHaveBeenCalled();
    });

    it("rejects expired tokens and tokens without owner", async () => {
        prisma.apiToken.findUnique.mockResolvedValueOnce({
            id: "t1", scopes: "read", expiresAt: new Date(Date.now() - 1), user: { id: "u1", role: "ADMIN" },
        });
        expect(await authenticate(bearer("bh_a"))).toBeNull();
        prisma.apiToken.findUnique.mockResolvedValueOnce({ id: "t2", scopes: "read", user: null });
        expect(await authenticate(bearer("bh_b"))).toBeNull();
    });

    it("does not fall back to the session when a bearer token is invalid", async () => {
        prisma.apiToken.findUnique.mockResolvedValue(null);
        getServerSession.mockResolvedValue({ user: { id: "u1", role: "ADMIN" } });
        expect(await authenticate(bearer("bh_bad"))).toBeNull();
        expect(getServerSession).not.toHaveBeenCalled();
    });

    it("returns null when token lookup throws", async () => {
        prisma.apiToken.findUnique.mockRejectedValue(new Error("db"));
        expect(await authenticate(bearer("bh_x"))).toBeNull();
    });

    describe("requireAuth", () => {
        it("returns 401 without credentials", async () => {
            getServerSession.mockResolvedValue(null);
            const { response } = await requireAuth(plain());
            expect(response.status).toBe(401);
        });

        it("returns 403 when the scope is missing", async () => {
            getServerSession.mockResolvedValue({ user: { id: "u1", role: "READONLY" } });
            const { response, auth } = await requireAuth(plain(), "write");
            expect(response.status).toBe(403);
            expect(auth.user.id).toBe("u1");
        });

        it("accepts any of several scopes", async () => {
            getServerSession.mockResolvedValue({ user: { id: "u1", role: "AUDIT" } });
            const { response } = await requireAuth(plain(), ["admin", "audit"]);
            expect(response).toBeUndefined();
        });

        it("passes with the required scope", async () => {
            getServerSession.mockResolvedValue({ user: { id: "u1", role: "ADMIN" } });
            const { response, auth } = await requireAuth(plain(), "admin");
            expect(response).toBeUndefined();
            expect(auth.user.role).toBe("ADMIN");
        });
    });
});
