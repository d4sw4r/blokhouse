// OIDC single sign-on configuration and role mapping (environment-driven).
import { ROLES } from "@/lib/auth";

const VALID_ROLES = ROLES.filter((r) => r !== "API");

function checkRole(role, varName) {
    if (!VALID_ROLES.includes(role)) {
        throw new Error(`${varName}: invalid role "${role}" (allowed: ${VALID_ROLES.join(", ")})`);
    }
    return role;
}

function positiveInt(raw, varName) {
    const s = String(raw).trim();
    if (!/^\d+$/.test(s) || Number(s) <= 0) {
        throw new Error(`${varName} must be a positive integer, got "${raw}"`);
    }
    return Number(s);
}

function parseRoleMap(raw) {
    const out = [];
    for (const part of (raw || "").split(",")) {
        const entry = part.trim();
        if (!entry) continue;
        const idx = entry.lastIndexOf("=");
        const value = idx < 0 ? "" : entry.slice(0, idx).trim();
        const role = idx < 0 ? "" : entry.slice(idx + 1).trim();
        if (!value || !role) {
            throw new Error(`OIDC_ROLE_MAP: invalid entry "${entry}" (expected value=ROLE)`);
        }
        out.push({ value, role: checkRole(role, "OIDC_ROLE_MAP") });
    }
    return out;
}

export function parseOidcConfig(env = process.env) {
    const issuer = (env.OIDC_ISSUER || "").trim();
    const clientId = (env.OIDC_CLIENT_ID || "").trim();
    const clientSecret = (env.OIDC_CLIENT_SECRET || "").trim();
    if (!issuer && !clientId && !clientSecret) return null;
    if (!issuer) throw new Error("OIDC_ISSUER is required when OIDC is configured");
    if (!clientId) throw new Error("OIDC_CLIENT_ID is required when OIDC_ISSUER is set");
    if (!clientSecret) throw new Error("OIDC_CLIENT_SECRET is required when OIDC_ISSUER is set");
    return {
        issuer,
        clientId,
        clientSecret,
        name: (env.OIDC_NAME || "").trim() || "Single sign-on",
        scopes: (env.OIDC_SCOPES || "").trim() || "openid email profile",
        roleClaim: (env.OIDC_ROLE_CLAIM || "").trim() || "groups",
        roleMap: parseRoleMap(env.OIDC_ROLE_MAP),
        defaultRole: checkRole((env.OIDC_DEFAULT_ROLE || "").trim() || "READONLY", "OIDC_DEFAULT_ROLE"),
        trustEmail: (env.OIDC_TRUST_EMAIL || "").trim().toLowerCase() === "true",
        tokenMaxDays:
            env.OIDC_TOKEN_MAX_DAYS === undefined || env.OIDC_TOKEN_MAX_DAYS === ""
                ? 90
                : positiveInt(env.OIDC_TOKEN_MAX_DAYS, "OIDC_TOKEN_MAX_DAYS"),
    };
}

let cached;
export function getOidcConfig() {
    if (cached === undefined) cached = parseOidcConfig(process.env);
    return cached;
}

export function passwordLoginEnabled(env = process.env) {
    return (env.PASSWORD_LOGIN || "").trim().toLowerCase() !== "false";
}

export function sessionMaxAge(env = process.env) {
    if (env.SESSION_MAX_AGE === undefined || env.SESSION_MAX_AGE === "") return 2592000;
    return positiveInt(env.SESSION_MAX_AGE, "SESSION_MAX_AGE");
}

export function validateAuthConfig(env = process.env) {
    const cfg = parseOidcConfig(env);
    sessionMaxAge(env);
    if (!passwordLoginEnabled(env) && !cfg) {
        throw new Error("PASSWORD_LOGIN=false requires OIDC to be configured (OIDC_ISSUER, OIDC_CLIENT_ID, OIDC_CLIENT_SECRET)");
    }
}

export function mapRole(config, claimValue) {
    if (claimValue === undefined || claimValue === null) return null;
    const list = Array.isArray(claimValue) ? claimValue : [claimValue];
    const have = new Set(
        list.filter((v) => typeof v === "string").map((v) => (v.startsWith("/") ? v.slice(1) : v)),
    );
    for (const { value, role } of config.roleMap) {
        if (have.has(value)) return role;
    }
    return null;
}
