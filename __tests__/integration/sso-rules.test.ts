import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";

const sessionMock = vi.hoisted(() => ({ current: null as unknown }));
vi.mock("next-auth/next", () => ({ getServerSession: async () => sessionMock.current }));

// getOidcConfig is memoized from process.env; tests swap the config directly.
const cfgMock = vi.hoisted(() => ({ current: null as unknown }));
vi.mock("@/lib/oidc", async (orig) => ({
    ...(await orig<typeof import("@/lib/oidc")>()),
    getOidcConfig: () => cfgMock.current,
}));

import { resetDb, tokenFor, call, prisma } from "./helpers";
import { parseOidcConfig } from "@/lib/oidc";
import * as UsersRoute from "@/app/api/users/route";
import * as UserRoute from "@/app/api/users/[id]/route";
import * as TokensRoute from "@/app/api/api-tokens/route";
import * as OptionsRoute from "@/app/api/auth/options/route";

type Handler = (req: Request, ctx?: { params?: Promise<{ id: string }> }) => Promise<Response>;

const BASE = { OIDC_ISSUER: "https://idp.test/x", OIDC_CLIENT_ID: "b", OIDC_CLIENT_SECRET: "s" };
const setCfg = (extra: Record<string, string> = {}) => {
    cfgMock.current = parseOidcConfig({ ...BASE, ...extra } as unknown as NodeJS.ProcessEnv);
};
const MAPPED = { OIDC_ROLE_MAP: "cmdb-admins=ADMIN,cmdb-users=USER" };

let admin: { user: { id: string } };

beforeEach(async () => {
    sessionMock.current = null;
    cfgMock.current = null;
    await resetDb();
    admin = await tokenFor("ADMIN", ["read", "write", "admin"]);
});

afterAll(async () => {
    await prisma.$disconnect();
});

const asSession = (u: { id: string; role: string; email?: string }) => {
    sessionMock.current = { user: { id: u.id, role: u.role, email: u.email ?? "x@test.io" } };
};
const ssoUser = async (role = "USER", email = "sso@corp.com") => {
    const u = await prisma.user.create({ data: { email, role } });
    await prisma.account.create({ data: { userId: u.id, type: "oauth", provider: "oidc", providerAccountId: `sub-${email}` } });
    return u;
};
const put = (id: string, body: unknown) => {
    asSession({ id: admin.user.id, role: "ADMIN" });
    return call(UserRoute.PUT as Handler, { method: "PUT", url: `/api/users/${id}`, body, params: { id } });
};
const postToken = (user: { id: string; role: string }, body: unknown) => {
    asSession(user);
    return call(TokensRoute.POST as Handler, { method: "POST", url: "/api/api-tokens", body });
};

describe("role lock for SSO users", () => {
    it("409 on a role change when a role map is set", async () => {
        setCfg(MAPPED);
        const u = await ssoUser("USER");
        const r = await put(u.id, { role: "AUDIT" });
        expect(r.status).toBe(409);
        expect(r.body.error).toBe("The role of this user is managed by the identity provider (OIDC_ROLE_MAP)");
        expect((await prisma.user.findUnique({ where: { id: u.id } }))!.role).toBe("USER");
    });

    it("sending the current role is not a change", async () => {
        setCfg(MAPPED);
        const u = await ssoUser("USER");
        expect((await put(u.id, { role: "USER", name: "Sue" })).status).toBe(200);
    });

    it("200 on a role change without a role map", async () => {
        setCfg();
        const u = await ssoUser("USER");
        const r = await put(u.id, { role: "AUDIT" });
        expect(r.status).toBe(200);
        expect(r.body.role).toBe("AUDIT");
        expect(r.body.roleManagedBySso).toBe(false);
    });

    it("local users can still be changed when a role map is set", async () => {
        setCfg(MAPPED);
        const local = await prisma.user.create({ data: { email: "local@test.io", role: "USER" } });
        expect((await put(local.id, { role: "AUDIT" })).status).toBe(200);
    });

    it("200 on disabled:true with a role map", async () => {
        setCfg(MAPPED);
        const u = await ssoUser("USER");
        const r = await put(u.id, { disabled: true });
        expect(r.status).toBe(200);
        expect(r.body.disabledAt).toBeTruthy();
        expect(r.body.sso).toBe(true);
    });

    it("409 when setting a password for an SSO user (with or without a role map)", async () => {
        for (const extra of [{}, MAPPED]) {
            setCfg(extra);
            const u = await ssoUser("USER", `pw${Object.keys(extra).length}@corp.com`);
            const r = await put(u.id, { password: "long-enough-pw" });
            expect(r.status).toBe(409);
            expect(r.body.error).toBe("This user signs in via single sign-on and cannot have a password");
            expect((await prisma.user.findUnique({ where: { id: u.id } }))!.password).toBeNull();
        }
    });

    it("GET /api/users and /api/users/:id expose sso and roleManagedBySso", async () => {
        setCfg(MAPPED);
        const u = await ssoUser("USER");
        const local = await prisma.user.create({ data: { email: "local@test.io", role: "USER" } });
        asSession({ id: admin.user.id, role: "ADMIN" });
        const list = await call(UsersRoute.GET as Handler, { url: "/api/users" });
        const byId = Object.fromEntries(list.body.map((x: { id: string }) => [x.id, x]));
        expect(byId[u.id]).toMatchObject({ sso: true, roleManagedBySso: true });
        expect(byId[local.id]).toMatchObject({ sso: false, roleManagedBySso: false });
        expect(byId[u.id].accounts).toBeUndefined();
        const one = await call(UserRoute.GET as Handler, { url: `/api/users/${u.id}`, params: { id: u.id } });
        expect(one.body).toMatchObject({ sso: true, roleManagedBySso: true });
        expect(one.body.accounts).toBeUndefined();
    });
});

describe("API token expiry for SSO users", () => {
    it("requires expiresInDays and caps it at OIDC_TOKEN_MAX_DAYS", async () => {
        setCfg(); // default 90
        const u = await ssoUser("USER");
        const none = await postToken(u, { name: "t" });
        expect(none.status).toBe(400);
        expect(none.body.error).toBe("API tokens of SSO users must expire within 90 days");
        const ok = await postToken(u, { name: "t", expiresInDays: "30" });
        expect(ok.status).toBe(201);
        expect(ok.body.expiresAt).toBeTruthy();
        const over = await postToken(u, { name: "t", expiresInDays: 91 });
        expect(over.status).toBe(400);
        expect(over.body.error).toBe("API tokens of SSO users must expire within 90 days");
        expect((await postToken(u, { name: "t", expiresInDays: 90 })).status).toBe(201);
    });

    it("leaves local users unchanged", async () => {
        setCfg();
        const local = await prisma.user.create({ data: { email: "local@test.io", role: "USER" } });
        const r = await postToken(local, { name: "t" });
        expect(r.status).toBe(201);
        expect(r.body.expiresAt).toBeNull();
    });
});

describe("GET /api/auth/options", () => {
    it("reports password login, SSO name and token cap", async () => {
        setCfg({ OIDC_NAME: "Corp", OIDC_TOKEN_MAX_DAYS: "45" });
        const on = await call(OptionsRoute.GET as Handler, { url: "/api/auth/options" });
        expect(on.body).toEqual({ passwordLogin: true, sso: { name: "Corp" }, ssoTokenMaxDays: 45 });
        cfgMock.current = null;
        const off = await call(OptionsRoute.GET as Handler, { url: "/api/auth/options" });
        expect(off.body).toEqual({ passwordLogin: true, sso: null, ssoTokenMaxDays: null });
    });
});
