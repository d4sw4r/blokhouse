import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
    default: { apiToken: { findUnique: vi.fn(), update: vi.fn() } },
}));
vi.mock("next-auth/next", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/authOptions", () => ({ default: {} }));

import { GET } from "../app/api/validate-token/route.js";
import prisma from "@/lib/prisma";
import { hashToken } from "@/lib/auth";

const req = (headers = {}, url = "http://localhost:3000/api/validate-token") => new Request(url, { headers });

describe("GET /api/validate-token", () => {
    beforeEach(() => vi.resetAllMocks());

    it("returns 400 without an Authorization header", async () => {
        const res = await GET(req());
        expect(res.status).toBe(400);
        expect((await res.json()).valid).toBe(false);
    });

    it("does not accept tokens in the query string", async () => {
        const res = await GET(req({}, "http://localhost:3000/api/validate-token?token=bh_abc"));
        expect(res.status).toBe(400);
        expect(prisma.apiToken.findUnique).not.toHaveBeenCalled();
    });

    it("returns 401 for an unknown token", async () => {
        prisma.apiToken.findUnique.mockResolvedValue(null);
        const res = await GET(req({ authorization: "Bearer bh_unknown" }));
        expect(res.status).toBe(401);
        expect(prisma.apiToken.findUnique).toHaveBeenCalledWith({
            where: { tokenHash: hashToken("bh_unknown") },
            include: { user: true },
        });
    });

    it("returns 401 for an expired token", async () => {
        prisma.apiToken.findUnique.mockResolvedValue({
            id: "t1", scopes: "read", expiresAt: new Date(Date.now() - 1000), user: { id: "u1", role: "USER" },
        });
        const res = await GET(req({ authorization: "Bearer bh_old" }));
        expect(res.status).toBe(401);
    });

    it("returns the effective scopes for a valid token", async () => {
        prisma.apiToken.findUnique.mockResolvedValue({
            id: "t1", scopes: "read,write,admin", expiresAt: null,
            user: { id: "u1", email: "u@x.io", role: "USER" },
        });
        prisma.apiToken.update.mockResolvedValue({});
        const res = await GET(req({ authorization: "Bearer bh_good" }));
        const data = await res.json();
        expect(res.status).toBe(200);
        expect(data.valid).toBe(true);
        // admin is stripped because the owner's role (USER) does not have it
        expect(data.scopes).toEqual(["read", "write"]);
        expect(data.user).toEqual({ email: "u@x.io", role: "USER" });
    });
});
