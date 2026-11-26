import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";

const sessionMock = vi.hoisted(() => ({ current: null as unknown }));
vi.mock("next-auth/next", () => ({ getServerSession: async () => sessionMock.current }));

import bcrypt from "bcryptjs";
import { resetDb, tokenFor, call, prisma } from "./helpers";
import * as UserRoute from "@/app/api/users/[id]/route";
import * as Items from "@/app/api/v1/configuration-items/route";
import { authorizeCredentials } from "@/lib/authOptions";

type Handler = (req: Request, ctx?: { params?: Promise<{ id: string }> }) => Promise<Response>;
let admin: { token: string; user: { id: string } };

beforeEach(async () => {
    sessionMock.current = null;
    await resetDb();
    admin = await tokenFor("ADMIN", ["read", "write", "admin"]);
});

afterAll(async () => {
    await prisma.$disconnect();
});

const put = (id: string, body: unknown, token = admin.token) =>
    call(UserRoute.PUT as Handler, { token, method: "PUT", url: `/api/users/${id}`, body, params: { id } });

describe("deactivating users", () => {
    it("sets disabledAt, writes an audit row and blocks the user's API token", async () => {
        const target = await tokenFor("USER", ["read"]);
        expect((await call(Items.GET, { token: target.token })).status).toBe(200);

        const r = await put(target.user.id, { disabled: true });
        expect(r.status).toBe(200);
        expect(r.body.disabledAt).toBeTruthy();

        const audit = await prisma.auditLog.findFirst({ where: { action: "USER_UPDATED", entityId: target.user.id } });
        expect(audit?.description).toContain("deactivated");

        expect((await call(Items.GET, { token: target.token })).status).toBe(401);

        const back = await put(target.user.id, { disabled: false });
        expect(back.status).toBe(200);
        expect(back.body.disabledAt).toBeNull();
        expect((await call(Items.GET, { token: target.token })).status).toBe(200);
    });

    it("refuses self-deactivation", async () => {
        const r = await put(admin.user.id, { disabled: true });
        expect(r.status).toBe(400);
        expect(r.body.error).toBe("You cannot deactivate your own account");
    });

    it("refuses deactivating the last active admin; deactivated admins do not count", async () => {
        // Target is the only active admin; the caller is a stale admin session (its user is already deactivated).
        const target = await prisma.user.create({ data: { email: "last@test.io", role: "ADMIN" } });
        const stale = await prisma.user.create({ data: { email: "stale@test.io", role: "ADMIN", disabledAt: new Date() } });
        await prisma.user.deleteMany({ where: { id: admin.user.id } });
        sessionMock.current = { user: { id: stale.id, role: "ADMIN", email: stale.email } };
        const r = await put(target.id, { disabled: true }, "");
        expect(r.status).toBe(400);
        expect(r.body.error).toBe("Cannot deactivate the last administrator");
        const d = await put(target.id, { role: "USER" }, "");
        expect(d.body.error).toBe("Cannot demote the last administrator");
        const x = await call(UserRoute.DELETE as Handler, { method: "DELETE", url: `/api/users/${target.id}`, params: { id: target.id } });
        expect(x.body.error).toBe("Cannot delete the last administrator");
    });

    it("allows deactivating an admin when another active admin exists", async () => {
        const other = await tokenFor("ADMIN", ["admin"]);
        const r = await put(other.user.id, { disabled: true });
        expect(r.status).toBe(200);
    });

    it("authorize returns null for a deactivated user with the right password", async () => {
        const password = "correct-horse-1";
        const u = await prisma.user.create({
            data: { email: "dis@test.io", role: "USER", password: bcrypt.hashSync(password, 4) },
        });
        expect(await authorizeCredentials({ email: "dis@test.io", password })).toMatchObject({ id: u.id });
        await prisma.user.update({ where: { id: u.id }, data: { disabledAt: new Date() } });
        expect(await authorizeCredentials({ email: "dis@test.io", password })).toBeNull();
    });
});
