import { describe, it, expect, beforeEach, afterAll, afterEach, vi } from "vitest";
import bcrypt from "bcryptjs";
import { resetDb, prisma } from "./helpers";
import { parseOidcConfig } from "@/lib/oidc";
import { handleOidcSignIn } from "@/lib/sso";
import { authOptions, authorizeCredentials, oidcProvider } from "@/lib/authOptions";

const BASE_ENV = { OIDC_ISSUER: "https://idp.test/realms/x", OIDC_CLIENT_ID: "blokhouse", OIDC_CLIENT_SECRET: "s3cret" };
const cfg = (extra: Record<string, string> = {}) => parseOidcConfig({ ...BASE_ENV, ...extra } as unknown as NodeJS.ProcessEnv)!;
const account = (sub = "sub-1") => ({
    provider: "oidc",
    type: "oauth",
    providerAccountId: sub,
    access_token: "x",
    id_token: "y",
    token_type: "bearer",
    expires_at: 1,
});
const DAY = 24 * 60 * 60 * 1000;

beforeEach(async () => {
    await resetDb();
});

afterAll(async () => {
    await prisma.$disconnect();
});

describe("handleOidcSignIn", () => {
    it("creates a new user with the default role, an Account row, no password, and an audit row", async () => {
        const r = await handleOidcSignIn({
            account: account(),
            profile: { sub: "sub-1", email: "new@corp.com", email_verified: true, name: "New Person" },
            config: cfg(),
        });
        expect(r).toBe(true);
        const user = await prisma.user.findUnique({ where: { email: "new@corp.com" }, include: { accounts: true } });
        expect(user).toBeTruthy();
        expect(user!.role).toBe("READONLY");
        expect(user!.password).toBeNull();
        expect(user!.name).toBe("New Person");
        expect(user!.accounts).toHaveLength(1);
        expect(user!.accounts[0]).toMatchObject({
            provider: "oidc",
            type: "oauth",
            providerAccountId: "sub-1",
            access_token: "x",
            id_token: "y",
            token_type: "bearer",
            expires_at: 1,
        });
        const audit = await prisma.auditLog.findFirst({ where: { entityId: user!.id, action: "USER_CREATED" } });
        expect(audit?.userId).toBe(user!.id);
        expect(audit?.description).toContain("via SSO");
    });

    it("maps the role of a new user from the role claim (Keycloak path)", async () => {
        const r = await handleOidcSignIn({
            account: account(),
            profile: { sub: "sub-1", email: "adm@corp.com", email_verified: true, groups: ["/cmdb-admins"] },
            config: cfg({ OIDC_ROLE_MAP: "cmdb-admins=ADMIN" }),
        });
        expect(r).toBe(true);
        expect((await prisma.user.findUnique({ where: { email: "adm@corp.com" } }))!.role).toBe("ADMIN");
    });

    it("denies with SsoNoAccess when a map is set and the claim is missing; creates nothing", async () => {
        const r = await handleOidcSignIn({
            account: account(),
            profile: { sub: "sub-1", email: "none@corp.com", email_verified: true },
            config: cfg({ OIDC_ROLE_MAP: "cmdb-admins=ADMIN" }),
        });
        expect(r).toBe("/signin?error=SsoNoAccess");
        expect(await prisma.user.count()).toBe(0);
        expect(await prisma.account.count()).toBe(0);
    });

    it("syncs the role on a later sign-in with the same sub, with an audit row", async () => {
        const config = cfg({ OIDC_ROLE_MAP: "cmdb-admins=ADMIN,cmdb-read=READONLY" });
        const profile = { sub: "sub-1", email: "sync@corp.com", email_verified: true, groups: ["cmdb-admins"] };
        expect(await handleOidcSignIn({ account: account(), profile, config })).toBe(true);
        const user = await prisma.user.findUnique({ where: { email: "sync@corp.com" } });
        expect(user!.role).toBe("ADMIN");

        expect(await handleOidcSignIn({ account: account(), profile: { ...profile, groups: ["cmdb-read"] }, config })).toBe(true);
        expect((await prisma.user.findUnique({ where: { id: user!.id } }))!.role).toBe("READONLY");
        expect(await prisma.user.count()).toBe(1);
        const audit = await prisma.auditLog.findFirst({ where: { entityId: user!.id, action: "USER_UPDATED" } });
        expect(audit?.description).toContain("via SSO");
        expect(audit?.userId).toBe(user!.id);
    });

    it("keeps the role of a linked user on a later sign-in when no map is set", async () => {
        const config = cfg();
        const profile = { sub: "sub-1", email: "keep@corp.com", email_verified: true };
        expect(await handleOidcSignIn({ account: account(), profile, config })).toBe(true);
        await prisma.user.update({ where: { email: "keep@corp.com" }, data: { role: "USER" } });
        expect(await handleOidcSignIn({ account: account(), profile, config })).toBe(true);
        expect((await prisma.user.findUnique({ where: { email: "keep@corp.com" } }))!.role).toBe("USER");
    });

    describe("linking an existing local user", () => {
        let alice: { id: string };
        beforeEach(async () => {
            alice = await prisma.user.create({
                data: { email: "alice@corp.com", role: "USER", password: bcrypt.hashSync("pw-alice-123", 4) },
            });
            await prisma.apiToken.create({
                data: { name: "forever", tokenHash: "h1", prefix: "bh_1", userId: alice.id, expiresAt: null },
            });
            await prisma.apiToken.create({
                data: { name: "far", tokenHash: "h2", prefix: "bh_2", userId: alice.id, expiresAt: new Date(Date.now() + 400 * DAY) },
            });
            await prisma.apiToken.create({
                data: { name: "soon", tokenHash: "h3", prefix: "bh_3", userId: alice.id, expiresAt: new Date(Date.now() + 5 * DAY) },
            });
        });

        const profile = { sub: "sub-1", email: "Alice@Corp.com", email_verified: true, name: "Alice" };

        it("links on a verified email (case-insensitive), removes the password and caps tokens", async () => {
            expect(await handleOidcSignIn({ account: account(), profile, config: cfg() })).toBe(true);
            expect(await prisma.user.count()).toBe(1);
            const u = await prisma.user.findUnique({ where: { id: alice.id }, include: { accounts: true, ApiToken: true } });
            expect(u!.password).toBeNull();
            expect(u!.role).toBe("USER");
            expect(u!.accounts).toHaveLength(1);
            expect(u!.accounts[0].providerAccountId).toBe("sub-1");
            const byName = Object.fromEntries(u!.ApiToken.map((t) => [t.name, t.expiresAt!.getTime()]));
            const cap = Date.now() + 90 * DAY;
            expect(Math.abs(byName.forever - cap)).toBeLessThan(60_000);
            expect(Math.abs(byName.far - cap)).toBeLessThan(60_000);
            expect(Math.abs(byName.soon - (Date.now() + 5 * DAY))).toBeLessThan(60_000);
            const audit = await prisma.auditLog.findFirst({ where: { entityId: alice.id, action: "USER_UPDATED" } });
            expect(audit?.description).toContain("Linked SSO account");
            expect(audit?.userId).toBe(alice.id);
        });

        it("sets the mapped role when linking", async () => {
            const r = await handleOidcSignIn({
                account: account(),
                profile: { ...profile, roles: "Blokhouse.Audit" },
                config: cfg({ OIDC_ROLE_CLAIM: "roles", OIDC_ROLE_MAP: "Blokhouse.Audit=AUDIT" }),
            });
            expect(r).toBe(true);
            expect((await prisma.user.findUnique({ where: { id: alice.id } }))!.role).toBe("AUDIT");
        });

        it("refuses an unverified email with SsoEmailNotVerified and leaves the user unchanged", async () => {
            const unverified = { ...profile, email_verified: undefined };
            expect(await handleOidcSignIn({ account: account(), profile: unverified, config: cfg() })).toBe(
                "/signin?error=SsoEmailNotVerified",
            );
            expect(await handleOidcSignIn({ account: account(), profile: { ...profile, email_verified: "true" }, config: cfg() })).toBe(
                "/signin?error=SsoEmailNotVerified",
            );
            const u = await prisma.user.findUnique({ where: { id: alice.id }, include: { accounts: true } });
            expect(u!.password).not.toBeNull();
            expect(u!.accounts).toHaveLength(0);
        });

        it("links an unverified email when OIDC_TRUST_EMAIL=true", async () => {
            const unverified = { ...profile, email_verified: undefined };
            expect(await handleOidcSignIn({ account: account(), profile: unverified, config: cfg({ OIDC_TRUST_EMAIL: "true" }) })).toBe(true);
            const u = await prisma.user.findUnique({ where: { id: alice.id }, include: { accounts: true } });
            expect(u!.password).toBeNull();
            expect(u!.accounts).toHaveLength(1);
        });

        it("refuses with SsoNoAccess before linking when the map gives no role", async () => {
            const r = await handleOidcSignIn({ account: account(), profile, config: cfg({ OIDC_ROLE_MAP: "cmdb-admins=ADMIN" }) });
            expect(r).toBe("/signin?error=SsoNoAccess");
            const u = await prisma.user.findUnique({ where: { id: alice.id }, include: { accounts: true } });
            expect(u!.password).not.toBeNull();
            expect(u!.accounts).toHaveLength(0);
        });

        it("refuses a second, different sub for a user that is already linked", async () => {
            expect(await handleOidcSignIn({ account: account(), profile, config: cfg() })).toBe(true);
            const r = await handleOidcSignIn({ account: account("sub-other"), profile: { ...profile, sub: "sub-other" }, config: cfg() });
            expect(r).toBe("/signin?error=SsoAlreadyLinked");
            expect(await prisma.account.count()).toBe(1);
        });
    });

    it("refuses an ambiguous case-insensitive email match with SsoAlreadyLinked", async () => {
        await prisma.user.create({ data: { email: "Dup@corp.com", role: "USER" } });
        await prisma.user.create({ data: { email: "dup@corp.com", role: "USER" } });
        const r = await handleOidcSignIn({
            account: account(),
            profile: { sub: "sub-1", email: "dup@corp.com", email_verified: true },
            config: cfg(),
        });
        expect(r).toBe("/signin?error=SsoAlreadyLinked");
        expect(await prisma.account.count()).toBe(0);
    });

    it("returns SsoError instead of throwing on an unexpected failure", async () => {
        const spy = vi.spyOn(console, "error").mockImplementation(() => {});
        // A malformed config (no roleMap) makes the decision code throw for real.
        const r = await handleOidcSignIn({
            account: account(),
            profile: { sub: "sub-1", email: "x@corp.com", email_verified: true },
            config: {} as never,
        });
        expect(r).toBe("/signin?error=SsoError");
        expect(spy).toHaveBeenCalled();
        spy.mockRestore();
    });

    it("never links a local admin with a password (SsoLocalAdmin), user unchanged", async () => {
        const admin = await prisma.user.create({
            data: { email: "admin@corp.com", role: "ADMIN", password: bcrypt.hashSync("pw-admin-123", 4) },
        });
        const r = await handleOidcSignIn({
            account: account(),
            profile: { sub: "sub-1", email: "admin@corp.com", email_verified: true, groups: ["cmdb-admins"] },
            config: cfg({ OIDC_ROLE_MAP: "cmdb-admins=ADMIN", OIDC_TRUST_EMAIL: "true" }),
        });
        expect(r).toBe("/signin?error=SsoLocalAdmin");
        const u = await prisma.user.findUnique({ where: { id: admin.id }, include: { accounts: true } });
        expect(u!.password).toBe(admin.password);
        expect(u!.role).toBe("ADMIN");
        expect(u!.accounts).toHaveLength(0);
    });

    it("checks email_verified before the account's status (no probing with an unverified claim)", async () => {
        const admin = await prisma.user.create({
            data: { email: "admin@corp.com", role: "ADMIN", password: bcrypt.hashSync("pw-admin-123", 4) },
        });
        await prisma.user.create({ data: { email: "off@corp.com", role: "USER", disabledAt: new Date() } });
        await prisma.user.create({ data: { email: "svc@corp.com", role: "API" } });
        for (const email of ["admin@corp.com", "off@corp.com", "svc@corp.com"]) {
            expect(await handleOidcSignIn({ account: account(), profile: { sub: "sub-1", email }, config: cfg() })).toBe(
                "/signin?error=SsoEmailNotVerified",
            );
        }
        const u = await prisma.user.findUnique({ where: { id: admin.id }, include: { accounts: true } });
        expect(u!.password).toBe(admin.password);
        expect(await prisma.account.count()).toBe(0);
    });

    it("refuses linking an existing deactivated user or service account by email", async () => {
        await prisma.user.create({ data: { email: "off@corp.com", role: "USER", disabledAt: new Date() } });
        await prisma.user.create({ data: { email: "svc@corp.com", role: "API" } });
        expect(
            await handleOidcSignIn({ account: account(), profile: { sub: "sub-1", email: "off@corp.com", email_verified: true }, config: cfg() }),
        ).toBe("/signin?error=SsoDisabled");
        expect(
            await handleOidcSignIn({ account: account(), profile: { sub: "sub-1", email: "svc@corp.com", email_verified: true }, config: cfg() }),
        ).toBe("/signin?error=SsoServiceAccount");
        expect(await prisma.account.count()).toBe(0);
    });

    it("creates a user from preferred_username when there is no email claim", async () => {
        const r = await handleOidcSignIn({
            account: account(),
            profile: { sub: "sub-1", preferred_username: "bob@corp.com", name: "Bob" },
            config: cfg(),
        });
        expect(r).toBe(true);
        const u = await prisma.user.findUnique({ where: { email: "bob@corp.com" }, include: { accounts: true } });
        expect(u!.accounts).toHaveLength(1);
    });

    it("never links via preferred_username (SsoEmailNotVerified), even with OIDC_TRUST_EMAIL", async () => {
        const bob = await prisma.user.create({ data: { email: "Bob@corp.com", role: "USER", password: "hash" } });
        for (const config of [cfg(), cfg({ OIDC_TRUST_EMAIL: "true" })]) {
            const r = await handleOidcSignIn({
                account: account(),
                profile: { sub: "sub-1", preferred_username: "bob@corp.com", email_verified: true },
                config,
            });
            expect(r).toBe("/signin?error=SsoEmailNotVerified");
        }
        const u = await prisma.user.findUnique({ where: { id: bob.id }, include: { accounts: true } });
        expect(u!.accounts).toHaveLength(0);
        expect(u!.password).toBe("hash");
        expect(await prisma.user.count()).toBe(1);
    });

    it("refuses a linked user who is deactivated (SsoDisabled) or a service account (SsoServiceAccount)", async () => {
        const profile = { sub: "sub-1", email: "l@corp.com", email_verified: true };
        expect(await handleOidcSignIn({ account: account(), profile, config: cfg() })).toBe(true);
        await prisma.user.update({ where: { email: "l@corp.com" }, data: { disabledAt: new Date() } });
        expect(await handleOidcSignIn({ account: account(), profile, config: cfg() })).toBe("/signin?error=SsoDisabled");
        await prisma.user.update({ where: { email: "l@corp.com" }, data: { disabledAt: null, role: "API" } });
        expect(await handleOidcSignIn({ account: account(), profile, config: cfg() })).toBe("/signin?error=SsoServiceAccount");
    });

    it("leaves a linked user's role unchanged when the map denies access", async () => {
        const config = cfg({ OIDC_ROLE_MAP: "cmdb-admins=ADMIN" });
        const profile = { sub: "sub-1", email: "d@corp.com", email_verified: true, groups: ["cmdb-admins"] };
        expect(await handleOidcSignIn({ account: account(), profile, config })).toBe(true);
        expect(await handleOidcSignIn({ account: account(), profile: { ...profile, groups: [] }, config })).toBe(
            "/signin?error=SsoNoAccess",
        );
        expect((await prisma.user.findUnique({ where: { email: "d@corp.com" } }))!.role).toBe("ADMIN");
    });

    it("denies with SsoNoEmail without email or an email-like preferred_username", async () => {
        const r = await handleOidcSignIn({
            account: account(),
            profile: { sub: "sub-1", preferred_username: "bob" },
            config: cfg(),
        });
        expect(r).toBe("/signin?error=SsoNoEmail");
        expect(await prisma.user.count()).toBe(0);
    });
});

describe("authOptions wiring", () => {
    afterEach(() => vi.unstubAllEnvs());
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cb = authOptions.callbacks as any;

    it("credentials authorize returns null when PASSWORD_LOGIN=false", async () => {
        const password = "correct-horse-1";
        await prisma.user.create({ data: { email: "pw@corp.com", role: "ADMIN", password: bcrypt.hashSync(password, 4) } });
        expect(await authorizeCredentials({ email: "pw@corp.com", password })).toBeTruthy();
        vi.stubEnv("PASSWORD_LOGIN", "false");
        expect(await authorizeCredentials({ email: "pw@corp.com", password })).toBeNull();
    });

    it("signIn allows non-oidc providers unchanged", async () => {
        expect(await cb.signIn({ user: { id: "x" }, account: { provider: "credentials", type: "credentials" } })).toBe(true);
    });

    it("jwt sets token.role to null for a deactivated user", async () => {
        const u = await prisma.user.create({ data: { email: "gone@corp.com", role: "USER" } });
        expect((await cb.jwt({ token: { id: u.id, role: "USER" } })).role).toBe("USER");
        await prisma.user.update({ where: { id: u.id }, data: { disabledAt: new Date() } });
        expect((await cb.jwt({ token: { id: u.id, role: "USER" } })).role).toBeNull();
    });

    it("jwt and session expose sso from the sign-in account", async () => {
        const u = await prisma.user.create({ data: { email: "j@corp.com", role: "USER" } });
        const t1 = await cb.jwt({ token: {}, user: u, account: { provider: "oidc" } });
        expect(t1.sso).toBe(true);
        const t2 = await cb.jwt({ token: {}, user: u, account: { provider: "credentials" } });
        expect(t2.sso).toBe(false);
        const later = await cb.jwt({ token: { ...t1 } });
        expect(later.sso).toBe(true);
        const s = await cb.session({ session: { user: {} }, token: later });
        expect(s.user).toMatchObject({ id: u.id, role: "USER", sso: true });
        const s2 = await cb.session({ session: { user: {} }, token: t2 });
        expect(s2.user.sso).toBe(false);
    });

    it("builds the OIDC provider from the config", () => {
        const p = oidcProvider(cfg({ OIDC_NAME: "Keycloak" }));
        expect(p).toMatchObject({
            id: "oidc",
            name: "Keycloak",
            type: "oauth",
            wellKnown: "https://idp.test/realms/x/.well-known/openid-configuration",
            clientId: "blokhouse",
            clientSecret: "s3cret",
            authorization: { params: { scope: "openid email profile" } },
            idToken: true,
            checks: ["pkce", "state"],
        });
        expect(p.profile({ sub: "s", preferred_username: "u@x.io" })).toEqual({ id: "s", name: "u@x.io", email: null });
    });
});
