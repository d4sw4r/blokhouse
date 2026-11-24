import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
    default: {
        user: {
            findMany: vi.fn(),
            findUnique: vi.fn(),
            create: vi.fn(),
            update: vi.fn(),
            delete: vi.fn(),
            count: vi.fn(),
        },
        apiToken: { findUnique: vi.fn(), update: vi.fn() },
    },
}));
vi.mock("next-auth/next", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/authOptions", () => ({ default: {} }));
vi.mock("@/lib/audit", () => ({ createAuditLog: vi.fn() }));

import { GET as getUsers, POST as createUser } from "../app/api/users/route.js";
import { GET as getUser, PUT as updateUser, DELETE as deleteUser } from "../app/api/users/[id]/route.js";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { createAuditLog } from "@/lib/audit";

const req = (method = "GET", body) =>
    new Request("http://localhost:3000/api/users", {
        method,
        headers: { "content-type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
    });
const params = (id) => ({ params: Promise.resolve({ id }) });
const as = (role, id = "admin-1") => getServerSession.mockResolvedValue({ user: { id, role } });
const newUser = { name: "Bob", email: "bob@example.com", password: "s3cure-pass", role: "USER" };

describe("Users API", () => {
    beforeEach(() => vi.resetAllMocks());

    describe("authorization", () => {
        it.each(["USER", "API", "AUDIT", "READONLY"])("forbids %s from managing users", async (role) => {
            as(role, "u1");
            expect((await getUsers(req())).status).toBe(403);
            expect((await createUser(req("POST", newUser))).status).toBe(403);
            expect((await getUser(req(), params("x"))).status).toBe(403);
            expect((await updateUser(req("PUT", { role: "ADMIN" }), params("u1"))).status).toBe(403);
            expect((await deleteUser(req("DELETE"), params("x"))).status).toBe(403);
            expect(prisma.user.create).not.toHaveBeenCalled();
            expect(prisma.user.update).not.toHaveBeenCalled();
        });

        it("returns 401 when not authenticated", async () => {
            getServerSession.mockResolvedValue(null);
            expect((await getUsers(req())).status).toBe(401);
        });

        it("forbids a write-only API token", async () => {
            prisma.apiToken.findUnique.mockResolvedValue({
                id: "t", scopes: "read,write", user: { id: "admin-1", role: "ADMIN" },
            });
            const r = new Request("http://localhost/api/users", { headers: { authorization: "Bearer bh_x" } });
            expect((await getUsers(r)).status).toBe(403);
        });
    });

    describe("GET /api/users", () => {
        it("returns users without password hashes", async () => {
            as("ADMIN");
            prisma.user.findMany.mockResolvedValue([{ id: "1", email: "a@x.io", role: "ADMIN" }]);
            const res = await getUsers(req());
            expect(res.status).toBe(200);
            expect(prisma.user.findMany.mock.calls[0][0].select.password).toBeUndefined();
        });
    });

    describe("POST /api/users", () => {
        it("hashes the password and audits the creation", async () => {
            as("ADMIN");
            prisma.user.create.mockResolvedValue({ id: "u2", email: newUser.email, role: "USER" });
            const res = await createUser(req("POST", newUser));
            expect(res.status).toBe(201);
            const { data, select } = prisma.user.create.mock.calls[0][0];
            expect(data.password).toMatch(/^\$2[aby]\$/);
            expect(select.password).toBeUndefined();
            expect(createAuditLog).toHaveBeenCalledWith(expect.objectContaining({ action: "USER_CREATED" }));
        });

        it.each([
            ["invalid role", { ...newUser, role: "SUPERUSER" }],
            ["short password", { ...newUser, password: "123" }],
            ["invalid email", { ...newUser, email: "bob" }],
        ])("rejects %s", async (_l, body) => {
            as("ADMIN");
            const res = await createUser(req("POST", body));
            expect(res.status).toBe(400);
            expect(prisma.user.create).not.toHaveBeenCalled();
        });

        it("returns 500 on database errors", async () => {
            as("ADMIN");
            prisma.user.create.mockRejectedValue(new Error("unique"));
            expect((await createUser(req("POST", newUser))).status).toBe(500);
        });
    });

    describe("GET /api/users/[id]", () => {
        it("returns 404 for unknown users", async () => {
            as("ADMIN");
            prisma.user.findUnique.mockResolvedValue(null);
            expect((await getUser(req(), params("x"))).status).toBe(404);
        });
    });

    describe("PUT /api/users/[id]", () => {
        it("updates role and hashes a new password", async () => {
            as("ADMIN");
            prisma.user.findUnique.mockResolvedValue({ id: "u2", email: "b@x.io", role: "USER" });
            prisma.user.update.mockResolvedValue({ id: "u2", email: "b@x.io", role: "AUDIT" });
            const res = await updateUser(req("PUT", { role: "AUDIT", password: "new-password" }), params("u2"));
            expect(res.status).toBe(200);
            const { data } = prisma.user.update.mock.calls[0][0];
            expect(data.role).toBe("AUDIT");
            expect(data.password).toMatch(/^\$2[aby]\$/);
        });

        it("refuses to demote the last admin", async () => {
            as("ADMIN");
            prisma.user.findUnique.mockResolvedValue({ id: "admin-1", role: "ADMIN" });
            prisma.user.count.mockResolvedValue(0);
            const res = await updateUser(req("PUT", { role: "USER" }), params("admin-1"));
            expect(res.status).toBe(400);
            expect(prisma.user.update).not.toHaveBeenCalled();
        });

        it("rejects an invalid role", async () => {
            as("ADMIN");
            const res = await updateUser(req("PUT", { role: "ROOT" }), params("u2"));
            expect(res.status).toBe(400);
        });
    });

    describe("DELETE /api/users/[id]", () => {
        it("deletes a user", async () => {
            as("ADMIN");
            prisma.user.findUnique.mockResolvedValue({ id: "u2", email: "b@x.io", role: "USER" });
            prisma.user.delete.mockResolvedValue({});
            expect((await deleteUser(req("DELETE"), params("u2"))).status).toBe(200);
            expect(createAuditLog).toHaveBeenCalledWith(expect.objectContaining({ action: "USER_DELETED" }));
        });

        it("refuses to delete yourself", async () => {
            as("ADMIN", "admin-1");
            expect((await deleteUser(req("DELETE"), params("admin-1"))).status).toBe(400);
            expect(prisma.user.delete).not.toHaveBeenCalled();
        });

        it("refuses to delete the last admin", async () => {
            as("ADMIN", "admin-1");
            prisma.user.findUnique.mockResolvedValue({ id: "admin-2", role: "ADMIN" });
            prisma.user.count.mockResolvedValue(0);
            expect((await deleteUser(req("DELETE"), params("admin-2"))).status).toBe(400);
        });

        it("returns 404 for unknown users", async () => {
            as("ADMIN");
            prisma.user.findUnique.mockResolvedValue(null);
            expect((await deleteUser(req("DELETE"), params("x"))).status).toBe(404);
        });
    });
});
