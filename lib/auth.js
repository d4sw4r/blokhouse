/**
 * lib/auth.js
 * Central authentication & authorization for all API routes.
 *
 * Every API route MUST call `requireAuth()` (or `authenticate()`) itself.
 * The Next.js proxy only redirects unauthenticated *page* requests; it is not
 * a security boundary for /api.
 *
 * Two ways to authenticate:
 *   1. Browser session (NextAuth JWT cookie)
 *   2. API token:  Authorization: Bearer bh_xxx
 *
 * Permissions are expressed as scopes:
 *   read  – read CMDB data
 *   write – create / update / delete CMDB data
 *   admin – manage users, tokens of others, system settings, discovery
 *   audit – read audit logs
 *
 * A session gets the scopes of its user's role. An API token gets the
 * intersection of the scopes stored on the token and the scopes of the
 * owning user's role — so a token can never exceed its owner.
 */

import crypto from "crypto";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import authOptions from "@/lib/authOptions";

export const ROLES = ["ADMIN", "USER", "API", "AUDIT", "READONLY"];

export const ROLE_SCOPES = {
    ADMIN: ["read", "write", "admin", "audit"],
    USER: ["read", "write"],
    API: ["read", "write"],
    AUDIT: ["read", "audit"],
    READONLY: ["read"],
};

export const TOKEN_SCOPES = ["read", "write", "admin", "audit"];
export const TOKEN_PREFIX = "bh_";

export function scopesForRole(role) {
    return ROLE_SCOPES[role] || [];
}

export function isValidRole(role) {
    return ROLES.includes(role);
}

/** SHA-256 hex digest of a raw API token. Only the hash is stored. */
export function hashToken(rawToken) {
    return crypto.createHash("sha256").update(rawToken).digest("hex");
}

/** Generate a new raw API token, e.g. `bh_3f9a…` (67 chars). */
export function generateToken() {
    return TOKEN_PREFIX + crypto.randomBytes(32).toString("hex");
}

/** Normalise and validate a requested scope list for a new token. */
export function parseScopes(input) {
    const list = Array.isArray(input)
        ? input
        : typeof input === "string"
            ? input.split(",")
            : ["read"];
    const scopes = [...new Set(list.map((s) => String(s).trim()).filter(Boolean))];
    if (scopes.length === 0) return { scopes: ["read"] };
    const invalid = scopes.filter((s) => !TOKEN_SCOPES.includes(s));
    if (invalid.length) return { error: `Invalid scope(s): ${invalid.join(", ")}` };
    return { scopes };
}

function bearerToken(req) {
    const header = req?.headers?.get?.("authorization");
    if (!header || !header.startsWith("Bearer ")) return null;
    const token = header.slice("Bearer ".length).trim();
    return token || null;
}

async function authenticateToken(raw) {
    let record;
    try {
        record = await prisma.apiToken.findUnique({
            where: { tokenHash: hashToken(raw) },
            include: { user: true },
        });
    } catch (error) {
        console.error("API token lookup failed:", error);
        return null;
    }
    if (!record || !record.user) return null;
    if (record.expiresAt && new Date(record.expiresAt) <= new Date()) return null;

    const tokenScopes = String(record.scopes || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    const roleScopes = scopesForRole(record.user.role);
    const scopes = tokenScopes.filter((s) => roleScopes.includes(s));

    // Best-effort usage tracking; never block the request on it.
    try {
        const p = prisma.apiToken.update?.({
            where: { id: record.id },
            data: { lastUsedAt: new Date() },
        });
        if (p && typeof p.catch === "function") p.catch(() => {});
    } catch {
        /* ignore */
    }

    return {
        via: "token",
        tokenId: record.id,
        scopes,
        user: {
            id: record.user.id,
            name: record.user.name,
            email: record.user.email,
            role: record.user.role,
        },
    };
}

/**
 * Identify the caller. Returns null when unauthenticated.
 * A present-but-invalid Bearer token does NOT fall back to the session.
 */
export async function authenticate(req) {
    const raw = bearerToken(req);
    if (raw) return authenticateToken(raw);

    const session = await getServerSession(authOptions);
    if (!session?.user) return null;
    const role = session.user.role;
    return {
        via: "session",
        scopes: scopesForRole(role),
        user: {
            id: session.user.id,
            name: session.user.name,
            email: session.user.email,
            role,
        },
        session,
    };
}

export function hasScope(auth, scope) {
    return Boolean(auth && auth.scopes.includes(scope));
}

export function jsonError(status, error) {
    return new Response(JSON.stringify({ error }), {
        status,
        headers: { "Content-Type": "application/json" },
    });
}

/**
 * Authenticate and authorize in one step.
 *
 *   const { auth, response } = await requireAuth(req, "write");
 *   if (response) return response;
 *
 * @param {Request} req
 * @param {string|string[]} [scope="read"] required scope(s); with an array,
 *        ANY of them is sufficient.
 */
export async function requireAuth(req, scope = "read") {
    const auth = await authenticate(req);
    if (!auth) return { response: jsonError(401, "Unauthorized") };
    const needed = Array.isArray(scope) ? scope : [scope];
    if (!needed.some((s) => hasScope(auth, s))) {
        return {
            auth,
            response: jsonError(403, `Forbidden: requires '${needed.join("' or '")}' permission`),
        };
    }
    return { auth };
}
