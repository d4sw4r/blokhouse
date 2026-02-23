import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock prisma and bcrypt before importing route
vi.mock("@/lib/prisma", () => ({
    default: {
        user: {
            findUnique: vi.fn(),
            create: vi.fn(),
        },
    },
}));

vi.mock("bcryptjs", () => ({
    __esModule: true,
    default: {
        genSaltSync: vi.fn().mockReturnValue("salt123"),
        hashSync: vi.fn().mockReturnValue("hashedpassword123"),
    },
}));

import { POST } from "../app/api/auth/signup/route.js";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";

describe("Auth Signup API", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Reset bcrypt mock implementations
        bcrypt.genSaltSync.mockReturnValue("salt123");
        bcrypt.hashSync.mockReturnValue("hashedpassword123");
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    function makeRequest(body = {}) {
        return {
            url: "http://localhost:3000/api/auth/signup",
            headers: { get: vi.fn(() => null) },
            json: vi.fn().mockResolvedValue(body),
        };
    }

    // ─── Happy Path ────────────────────────────────────────────────────────────

    describe("successful signup", () => {
        it("creates a new user with hashed password", async () => {
            prisma.user.findUnique.mockResolvedValue(null); // No existing user
            prisma.user.create.mockResolvedValue({
                id: "u1",
                name: "John Doe",
                email: "john@example.com",
                role: "USER",
            });

            const body = { name: "John Doe", email: "john@example.com", password: "password123" };
            const res = await POST(makeRequest(body));
            const data = await res.json();

            expect(res.status).toBe(201);
            expect(data.message).toBe("User created successfully");
            expect(data.user.id).toBe("u1");
            expect(data.user.name).toBe("John Doe");
            expect(data.user.email).toBe("john@example.com");
        });

        it("hashes the password before storing", async () => {
            prisma.user.findUnique.mockResolvedValue(null);
            prisma.user.create.mockResolvedValue({ id: "u1", name: "Jane", email: "jane@example.com" });

            const body = { name: "Jane", email: "jane@example.com", password: "secret123" };
            await POST(makeRequest(body));

            expect(bcrypt.genSaltSync).toHaveBeenCalledWith(10);
            expect(bcrypt.hashSync).toHaveBeenCalledWith("secret123", "salt123");
            expect(prisma.user.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        password: "hashedpassword123",
                    }),
                })
            );
        });

        it("assigns USER role by default", async () => {
            prisma.user.findUnique.mockResolvedValue(null);
            prisma.user.create.mockResolvedValue({ id: "u1", name: "Test", email: "test@example.com", role: "USER" });

            const body = { name: "Test", email: "test@example.com", password: "pass" };
            await POST(makeRequest(body));

            expect(prisma.user.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        role: "USER",
                    }),
                })
            );
        });

        it("sets emailVerified to current date", async () => {
            prisma.user.findUnique.mockResolvedValue(null);
            prisma.user.create.mockResolvedValue({ id: "u1", name: "Test", email: "test@example.com" });

            const beforeTest = new Date().getTime();
            const body = { name: "Test", email: "test@example.com", password: "pass" };
            await POST(makeRequest(body));
            const afterTest = new Date().getTime();

            const callArgs = prisma.user.create.mock.calls[0][0];
            const emailVerifiedTime = new Date(callArgs.data.emailVerified).getTime();
            expect(emailVerifiedTime).toBeGreaterThanOrEqual(beforeTest);
            expect(emailVerifiedTime).toBeLessThanOrEqual(afterTest);
        });
    });

    // ─── Validation Errors ─────────────────────────────────────────────────────

    describe("validation errors", () => {
        it("returns 400 when user already exists", async () => {
            prisma.user.findUnique.mockResolvedValue({
                id: "existing",
                email: "existing@example.com",
            });

            const body = { name: "Test", email: "existing@example.com", password: "pass" };
            const res = await POST(makeRequest(body));
            const data = await res.json();

            expect(res.status).toBe(400);
            expect(data.error).toBe("User already exists");
            expect(prisma.user.create).not.toHaveBeenCalled();
        });

        it("checks for existing user by email", async () => {
            prisma.user.findUnique.mockResolvedValue(null);
            prisma.user.create.mockResolvedValue({ id: "u1", name: "Test", email: "test@example.com" });

            const body = { name: "Test", email: "test@example.com", password: "pass" };
            await POST(makeRequest(body));

            expect(prisma.user.findUnique).toHaveBeenCalledWith({
                where: { email: "test@example.com" },
            });
        });
    });

    // ─── Server Errors ─────────────────────────────────────────────────────────

    describe("server errors", () => {
        it("returns 500 when prisma.findUnique throws", async () => {
            prisma.user.findUnique.mockRejectedValue(new Error("DB connection failed"));

            const body = { name: "Test", email: "test@example.com", password: "pass" };
            const res = await POST(makeRequest(body));
            const data = await res.json();

            expect(res.status).toBe(500);
            expect(data.error).toBe("Signup failed");
        });

        it("returns 500 when prisma.create throws", async () => {
            prisma.user.findUnique.mockResolvedValue(null);
            prisma.user.create.mockRejectedValue(new Error("Unique constraint violation"));

            const body = { name: "Test", email: "test@example.com", password: "pass" };
            const res = await POST(makeRequest(body));
            const data = await res.json();

            expect(res.status).toBe(500);
            expect(data.error).toBe("Signup failed");
        });

        it("returns 500 when bcrypt throws", async () => {
            const { default: bcryptModule } = await import("bcryptjs");
            bcryptModule.genSaltSync.mockImplementation(() => {
                throw new Error("Salt generation failed");
            });
            prisma.user.findUnique.mockResolvedValue(null);

            const body = { name: "Test", email: "test@example.com", password: "pass" };
            const res = await POST(makeRequest(body));
            const data = await res.json();

            expect(res.status).toBe(500);
            expect(data.error).toBe("Signup failed");
            
            // Reset the mock
            bcryptModule.genSaltSync.mockReturnValue("salt123");
        });

        it("returns 500 when request.json() throws (malformed body)", async () => {
            const badRequest = {
                url: "http://localhost:3000/api/auth/signup",
                headers: { get: vi.fn(() => null) },
                json: vi.fn().mockRejectedValue(new Error("Unexpected token")),
            };

            const res = await POST(badRequest);
            const data = await res.json();

            expect(res.status).toBe(500);
            expect(data.error).toBe("Signup failed");
        });
    });

    // ─── Edge Cases ────────────────────────────────────────────────────────────

    describe("edge cases", () => {
        it("handles special characters in email", async () => {
            prisma.user.findUnique.mockResolvedValue(null);
            prisma.user.create.mockResolvedValue({
                id: "u1",
                name: "Test",
                email: "test+label@subdomain.example.com",
            });

            const body = { name: "Test", email: "test+label@subdomain.example.com", password: "pass" };
            const res = await POST(makeRequest(body));

            expect(res.status).toBe(201);
        });

        it("handles long passwords", async () => {
            prisma.user.findUnique.mockResolvedValue(null);
            prisma.user.create.mockResolvedValue({ id: "u1", name: "Test", email: "test@example.com" });

            const longPassword = "a".repeat(128);
            const body = { name: "Test", email: "test@example.com", password: longPassword };
            const res = await POST(makeRequest(body));

            expect(res.status).toBe(201);
            expect(bcrypt.hashSync).toHaveBeenCalledWith(longPassword, "salt123");
        });

        it("handles unicode characters in name", async () => {
            prisma.user.findUnique.mockResolvedValue(null);
            prisma.user.create.mockResolvedValue({
                id: "u1",
                name: "José García Müller 日本",
                email: "test@example.com",
            });

            const body = { name: "José García Müller 日本", email: "test@example.com", password: "pass" };
            const res = await POST(makeRequest(body));
            const data = await res.json();

            expect(res.status).toBe(201);
            expect(data.user.name).toBe("José García Müller 日本");
        });

        it("handles empty name field", async () => {
            prisma.user.findUnique.mockResolvedValue(null);
            prisma.user.create.mockResolvedValue({ id: "u1", name: "", email: "test@example.com" });

            const body = { name: "", email: "test@example.com", password: "pass" };
            const res = await POST(makeRequest(body));

            expect(res.status).toBe(201);
        });
    });
});
