import { describe, it, expect } from "vitest";
import { isPublicPath } from "../proxy.ts";

describe("proxy isPublicPath", () => {
    it.each(["/", "/signin", "/signup", "/api/auth/session", "/api/auth/callback/credentials", "/api/health", "/api/docs"])(
        "%s is public",
        (p) => expect(isPublicPath(p)).toBe(true)
    );

    it.each([
        "/dashboard", "/items", "/admin", "/admin/users",
        "/api/configuration-items", "/api/users", "/api/api-tokens", "/api/dashboard",
        "/api/discovery", "/api/validate-token", "/api/authx", "/api/healthz-secret-ish",
    ])("%s is protected", (p) => {
        // "/api/authx" and "/api/healthz…" share a prefix with public paths;
        // only exact matches or sub-paths may be public.
        expect(isPublicPath(p)).toBe(false);
    });
});
