import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock prisma before importing routes
vi.mock("@/lib/prisma", () => ({
    default: {
        user: {
            findMany: vi.fn(),
            findUnique: vi.fn(),
            create: vi.fn(),
            update: vi.fn(),
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

import { GET as getUsers, POST as createUser } from "../app/api/users/route.js";
import {
    GET as getUser,
    PUT as updateUser,
    DELETE as deleteUser,
} from "../app/api/users/[id]/route.js";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth/next";

describe("Users API", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    function makeRequest(options = {}) {
        return {
            url: options.url || "http://localhost:3000/api/users",
            headers: { get: vi.fn(() => null) },
            json: vi.fn().mockResolvedValue(options.body || {}),
        };
    }

    function makeParams(id) {
        return { params: { id } };
    }

    // ─── GET /api/users ────────────────────────────────────────────────────────

    describe("GET /api/users", () => {
        it("returns list of users when authenticated", async () => {
            getServerSession.mockResolvedValue({ user: { id: "u1", role: "ADMIN" } });
            const mockUsers = [
                { id: "u1", name: "Alice", email: "alice@example.com", role: "ADMIN" },
                { id: "u2", name: "Bob",   email: "bob@example.com",   role: "USER"  },
            ];
            prisma.user.findMany.mockResolvedValue(mockUsers);

            const res  = await getUsers(makeRequest());
            const data = await res.json();

            expect(res.status).toBe(200);
            expect(data).toHaveLength(2);
            expect(data[0].name).toBe("Alice");
            expect(data[1].role).toBe("USER");
        });

        it("returns 401 when not authenticated", async () => {
            getServerSession.mockResolvedValue(null);

            const res  = await getUsers(makeRequest());
            const data = await res.json();

            expect(res.status).toBe(401);
            expect(data.error).toBe("Unauthorized");
            expect(prisma.user.findMany).not.toHaveBeenCalled();
        });

        it("returns empty array when no users exist", async () => {
            getServerSession.mockResolvedValue({ user: { id: "u1" } });
            prisma.user.findMany.mockResolvedValue([]);

            const res  = await getUsers(makeRequest());
            const data = await res.json();

            expect(res.status).toBe(200);
            expect(data).toEqual([]);
        });

        it("only selects safe fields (no password)", async () => {
            getServerSession.mockResolvedValue({ user: { id: "u1" } });
            prisma.user.findMany.mockResolvedValue([]);

            await getUsers(makeRequest());

            expect(prisma.user.findMany).toHaveBeenCalledWith({
                select: { id: true, name: true, email: true, role: true },
            });
        });
    });

    // ─── POST /api/users ───────────────────────────────────────────────────────

    describe("POST /api/users", () => {
        it("creates a user and returns 201", async () => {
            getServerSession.mockResolvedValue({ user: { id: "u1", role: "ADMIN" } });
            const body = { name: "Carol", email: "carol@example.com", password: "secret", role: "USER" };
            const created = { id: "u3", name: "Carol", email: "carol@example.com", role: "USER" };
            prisma.user.create.mockResolvedValue(created);

            const res  = await createUser(makeRequest({ body }));
            const data = await res.json();

            expect(res.status).toBe(201);
            expect(data.id).toBe("u3");
            expect(data.name).toBe("Carol");
            expect(data.email).toBe("carol@example.com");
        });

        it("returns 401 when not authenticated", async () => {
            getServerSession.mockResolvedValue(null);

            const res = await createUser(makeRequest({ body: { name: "X" } }));
            expect(res.status).toBe(401);
            expect(prisma.user.create).not.toHaveBeenCalled();
        });

        it("returns 500 on prisma error", async () => {
            getServerSession.mockResolvedValue({ user: { id: "u1" } });
            prisma.user.create.mockRejectedValue(new Error("Unique constraint failed"));

            const res  = await createUser(makeRequest({ body: { name: "X", email: "x@x.com" } }));
            const data = await res.json();

            expect(res.status).toBe(500);
            expect(data.error).toBe("Could not create user");
        });

        it("passes all fields to prisma.user.create", async () => {
            getServerSession.mockResolvedValue({ user: { id: "u1" } });
            prisma.user.create.mockResolvedValue({ id: "u9", name: "Dave", email: "d@d.com", role: "ADMIN" });

            const body = { name: "Dave", email: "d@d.com", password: "pw", role: "ADMIN" };
            await createUser(makeRequest({ body }));

            expect(prisma.user.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        name:  "Dave",
                        email: "d@d.com",
                        role:  "ADMIN",
                    }),
                })
            );
        });
    });

    // ─── GET /api/users/[id] ───────────────────────────────────────────────────

    describe("GET /api/users/[id]", () => {
        it("returns a single user by ID", async () => {
            getServerSession.mockResolvedValue({ user: { id: "u1" } });
            const mockUser = { id: "u2", name: "Bob", email: "bob@example.com", role: "USER" };
            prisma.user.findUnique.mockResolvedValue(mockUser);

            const res  = await getUser(makeRequest(), makeParams("u2"));
            const data = await res.json();

            expect(res.status).toBe(200);
            expect(data.id).toBe("u2");
            expect(data.name).toBe("Bob");
        });

        it("returns 404 when user does not exist", async () => {
            getServerSession.mockResolvedValue({ user: { id: "u1" } });
            prisma.user.findUnique.mockResolvedValue(null);

            const res  = await getUser(makeRequest(), makeParams("nonexistent"));
            const data = await res.json();

            expect(res.status).toBe(404);
            expect(data.error).toBe("Not found");
        });

        it("returns 401 when not authenticated", async () => {
            getServerSession.mockResolvedValue(null);

            const res = await getUser(makeRequest(), makeParams("u1"));
            expect(res.status).toBe(401);
        });

        it("looks up user with correct ID", async () => {
            getServerSession.mockResolvedValue({ user: { id: "u1" } });
            prisma.user.findUnique.mockResolvedValue({ id: "u5", name: "Eve", email: "e@e.com", role: "USER" });

            await getUser(makeRequest(), makeParams("u5"));

            expect(prisma.user.findUnique).toHaveBeenCalledWith(
                expect.objectContaining({ where: { id: "u5" } })
            );
        });

        it("only selects safe fields", async () => {
            getServerSession.mockResolvedValue({ user: { id: "u1" } });
            prisma.user.findUnique.mockResolvedValue({ id: "u5", name: "Eve", email: "e@e.com", role: "USER" });

            await getUser(makeRequest(), makeParams("u5"));

            expect(prisma.user.findUnique).toHaveBeenCalledWith(
                expect.objectContaining({
                    select: { id: true, name: true, email: true, role: true },
                })
            );
        });
    });

    // ─── PUT /api/users/[id] ───────────────────────────────────────────────────

    describe("PUT /api/users/[id]", () => {
        it("updates and returns the user", async () => {
            getServerSession.mockResolvedValue({ user: { id: "u1", role: "ADMIN" } });
            const updated = { id: "u2", name: "Bob Updated", email: "bob2@example.com", role: "ADMIN" };
            prisma.user.update.mockResolvedValue(updated);

            const body = { name: "Bob Updated", email: "bob2@example.com", role: "ADMIN" };
            const res  = await updateUser(makeRequest({ body }), makeParams("u2"));
            const data = await res.json();

            expect(res.status).toBe(200);
            expect(data.name).toBe("Bob Updated");
            expect(data.role).toBe("ADMIN");
        });

        it("returns 401 when not authenticated", async () => {
            getServerSession.mockResolvedValue(null);

            const res = await updateUser(makeRequest({ body: {} }), makeParams("u2"));
            expect(res.status).toBe(401);
        });

        it("returns 500 on prisma error (e.g. not found)", async () => {
            getServerSession.mockResolvedValue({ user: { id: "u1" } });
            prisma.user.update.mockRejectedValue(new Error("Record not found"));

            const res  = await updateUser(makeRequest({ body: { name: "X" } }), makeParams("u99"));
            const data = await res.json();

            expect(res.status).toBe(500);
            expect(data.error).toBe("Update failed");
        });

        it("passes correct data to prisma.user.update", async () => {
            getServerSession.mockResolvedValue({ user: { id: "u1" } });
            prisma.user.update.mockResolvedValue({ id: "u2", name: "N", email: "n@n.com", role: "USER" });

            const body = { name: "N", email: "n@n.com", role: "USER" };
            await updateUser(makeRequest({ body }), makeParams("u2"));

            expect(prisma.user.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { id: "u2" },
                    data: { name: "N", email: "n@n.com", role: "USER" },
                })
            );
        });
    });

    // ─── DELETE /api/users/[id] ────────────────────────────────────────────────

    describe("DELETE /api/users/[id]", () => {
        it("deletes user and returns 200", async () => {
            getServerSession.mockResolvedValue({ user: { id: "u1", role: "ADMIN" } });
            prisma.user.delete.mockResolvedValue({});

            const res  = await deleteUser(makeRequest(), makeParams("u2"));
            const data = await res.json();

            expect(res.status).toBe(200);
            expect(data.message).toBe("Deleted");
        });

        it("returns 401 when not authenticated", async () => {
            getServerSession.mockResolvedValue(null);

            const res = await deleteUser(makeRequest(), makeParams("u2"));
            expect(res.status).toBe(401);
            expect(prisma.user.delete).not.toHaveBeenCalled();
        });

        it("returns 500 on prisma error", async () => {
            getServerSession.mockResolvedValue({ user: { id: "u1" } });
            prisma.user.delete.mockRejectedValue(new Error("Record not found"));

            const res  = await deleteUser(makeRequest(), makeParams("u99"));
            const data = await res.json();

            expect(res.status).toBe(500);
            expect(data.error).toBe("Delete failed");
        });

        it("calls prisma.user.delete with correct ID", async () => {
            getServerSession.mockResolvedValue({ user: { id: "u1" } });
            prisma.user.delete.mockResolvedValue({});

            await deleteUser(makeRequest(), makeParams("u7"));

            expect(prisma.user.delete).toHaveBeenCalledWith({ where: { id: "u7" } });
        });
    });
});
