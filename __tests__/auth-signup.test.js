import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
    default: { user: { findUnique: vi.fn(), create: vi.fn() } },
}));

import { GET, POST } from "../app/api/auth/signup/route.js";
import prisma from "@/lib/prisma";

const req = (body) =>
    new Request("http://localhost:3000/api/auth/signup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: typeof body === "string" ? body : JSON.stringify(body),
    });

const valid = { name: "Jane", email: "jane@example.com", password: "correct-horse" };

describe("Auth Signup API", () => {
    beforeEach(() => vi.resetAllMocks());
    afterEach(() => vi.unstubAllEnvs());

    describe("when ALLOW_SIGNUP is not set", () => {
        it("reports signup as disabled", async () => {
            const res = await GET();
            expect((await res.json()).enabled).toBe(false);
        });

        it("rejects registration with 403", async () => {
            const res = await POST(req(valid));
            expect(res.status).toBe(403);
            expect(prisma.user.create).not.toHaveBeenCalled();
        });
    });

    describe("when ALLOW_SIGNUP=true", () => {
        beforeEach(() => vi.stubEnv("ALLOW_SIGNUP", "true"));

        it("reports signup as enabled", async () => {
            expect((await (await GET()).json()).enabled).toBe(true);
        });

        it("creates a READONLY user with a bcrypt hash and never returns it", async () => {
            prisma.user.findUnique.mockResolvedValue(null);
            prisma.user.create.mockImplementation(async ({ data, select }) => {
                const full = { id: "u1", ...data };
                return Object.fromEntries(Object.keys(select).map((k) => [k, full[k]]));
            });

            const res = await POST(req(valid));
            const data = await res.json();

            expect(res.status).toBe(201);
            const { data: stored, select } = prisma.user.create.mock.calls[0][0];
            expect(stored.role).toBe("READONLY");
            expect(stored.password).toMatch(/^\$2[aby]\$/);
            expect(stored.password).not.toBe(valid.password);
            expect(select.password).toBeUndefined();
            expect(data.user.password).toBeUndefined();
            expect(data.user.role).toBe("READONLY");
        });

        it("ignores a role supplied by the client", async () => {
            prisma.user.findUnique.mockResolvedValue(null);
            prisma.user.create.mockResolvedValue({ id: "u1" });
            await POST(req({ ...valid, role: "ADMIN" }));
            expect(prisma.user.create.mock.calls[0][0].data.role).toBe("READONLY");
        });

        it("returns 400 when the user already exists", async () => {
            prisma.user.findUnique.mockResolvedValue({ id: "existing" });
            const res = await POST(req(valid));
            expect(res.status).toBe(400);
            expect((await res.json()).error).toBe("User already exists");
            expect(prisma.user.create).not.toHaveBeenCalled();
        });

        it.each([
            ["invalid email", { ...valid, email: "not-an-email" }],
            ["missing email", { ...valid, email: undefined }],
            ["short password", { ...valid, password: "short" }],
            ["missing password", { ...valid, password: undefined }],
        ])("returns 400 for %s", async (_label, body) => {
            const res = await POST(req(body));
            expect(res.status).toBe(400);
            expect(prisma.user.create).not.toHaveBeenCalled();
        });

        it("returns 500 for a malformed body", async () => {
            const res = await POST(req("{not json"));
            expect(res.status).toBe(500);
        });

        it("returns 500 when the database fails", async () => {
            prisma.user.findUnique.mockRejectedValue(new Error("DB"));
            const res = await POST(req(valid));
            expect(res.status).toBe(500);
        });
    });
});
