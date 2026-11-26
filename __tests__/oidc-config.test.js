import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ default: {} }));
vi.mock("next-auth/next", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/authOptions", () => ({ default: {} }));

import { ROLES } from "@/lib/auth";
import {
    VALID_ROLES, parseOidcConfig, passwordLoginEnabled, sessionMaxAge, validateAuthConfig, mapRole,
} from "@/lib/oidc";

const base = { OIDC_ISSUER: "https://idp.example.com", OIDC_CLIENT_ID: "id", OIDC_CLIENT_SECRET: "sec" };

describe("parseOidcConfig", () => {
    it("returns null when SSO is not configured", () => {
        expect(parseOidcConfig({})).toBeNull();
    });
    it("throws naming the missing variable", () => {
        expect(() => parseOidcConfig({ OIDC_ISSUER: "https://x" })).toThrow(/OIDC_CLIENT_ID/);
    });
    it("applies defaults", () => {
        expect(parseOidcConfig(base)).toEqual({
            issuer: "https://idp.example.com", clientId: "id", clientSecret: "sec",
            name: "Single sign-on", scopes: "openid email profile", roleClaim: "groups",
            roleMap: [], defaultRole: "READONLY", trustEmail: false, tokenMaxDays: 90,
        });
    });
    it("parses the role map", () => {
        const c = parseOidcConfig({ ...base, OIDC_ROLE_MAP: " cmdb-admins = ADMIN , ,cmdb-read=READONLY" });
        expect(c.roleMap).toEqual([
            { value: "cmdb-admins", role: "ADMIN" }, { value: "cmdb-read", role: "READONLY" },
        ]);
    });
    it("rejects invalid roles", () => {
        expect(() => parseOidcConfig({ ...base, OIDC_ROLE_MAP: "x=ADMN" })).toThrow(/ADMN/);
        expect(() => parseOidcConfig({ ...base, OIDC_ROLE_MAP: "x=API" })).toThrow(/API/);
        expect(() => parseOidcConfig({ ...base, OIDC_DEFAULT_ROLE: "API" })).toThrow(/OIDC_DEFAULT_ROLE/);
    });
    it("rejects invalid token max days", () => {
        expect(() => parseOidcConfig({ ...base, OIDC_TOKEN_MAX_DAYS: "0" })).toThrow(/OIDC_TOKEN_MAX_DAYS/);
    });
});

describe("mapRole", () => {
    const cfg = { roleMap: [{ value: "cmdb-admins", role: "ADMIN" }, { value: "cmdb-read", role: "READONLY" }] };
    it("picks the first matching map entry", () => {
        expect(mapRole(cfg, ["cmdb-read", "cmdb-admins"])).toBe("ADMIN");
    });
    it("strips one leading slash", () => {
        expect(mapRole(cfg, "/cmdb-admins")).toBe("ADMIN");
        expect(mapRole(cfg, ["//cmdb-admins"])).toBeNull();
    });
    it("accepts a string claim", () => {
        expect(mapRole(cfg, "cmdb-read")).toBe("READONLY");
    });
    it("returns null on no match or missing claim", () => {
        expect(mapRole(cfg, ["other"])).toBeNull();
        expect(mapRole(cfg, undefined)).toBeNull();
    });
});

describe("password login / session / validate", () => {
    it("passwordLoginEnabled", () => {
        expect(passwordLoginEnabled({})).toBe(true);
        expect(passwordLoginEnabled({ PASSWORD_LOGIN: "FALSE" })).toBe(false);
    });
    it("sessionMaxAge", () => {
        expect(sessionMaxAge({})).toBe(2592000);
        expect(sessionMaxAge({ SESSION_MAX_AGE: "28800" })).toBe(28800);
        expect(() => sessionMaxAge({ SESSION_MAX_AGE: "abc" })).toThrow(/SESSION_MAX_AGE/);
    });
    it("validateAuthConfig requires SSO when password login is off", () => {
        expect(() => validateAuthConfig({ PASSWORD_LOGIN: "false" })).toThrow(/PASSWORD_LOGIN/);
        expect(() => validateAuthConfig({ ...base, PASSWORD_LOGIN: "false" })).not.toThrow();
        expect(() => validateAuthConfig({})).not.toThrow();
    });
});

describe("VALID_ROLES", () => {
    it("matches lib/auth ROLES minus API", () => {
        expect(VALID_ROLES).toEqual(ROLES.filter((r) => r !== "API"));
    });
});
