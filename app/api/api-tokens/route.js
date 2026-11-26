// app/api/api-tokens/route.js
// Manage API tokens. Users see and create their own tokens; admins may list
// all tokens with ?all=true. Raw tokens are returned exactly once on creation
// and only a SHA-256 hash is stored.
import prisma from "@/lib/prisma";
import { requireAuth, hasScope, generateToken, hashToken, parseScopes, scopesForRole, jsonError } from "@/lib/auth";
import { logTokenCreated } from "@/lib/audit";
import { getOidcConfig } from "@/lib/oidc";
import { isSsoUser } from "@/lib/sso";

const TOKEN_SELECT = {
    id: true,
    name: true,
    prefix: true,
    scopes: true,
    expiresAt: true,
    lastUsedAt: true,
    createdAt: true,
    userId: true,
};

function serialize(token) {
    return { ...token, scopes: String(token.scopes || "").split(",").filter(Boolean) };
}

export async function GET(request) {
    // Token management is session-only: a leaked token must not mint new tokens.
    const { auth, response } = await requireAuth(request, "read");
    if (response) return response;
    if (auth.via !== "session") return jsonError(403, "Token management requires an interactive session");

    const url = new URL(request.url);
    const all = url.searchParams.get("all") === "true" && hasScope(auth, "admin");

    const tokens = await prisma.apiToken.findMany({
        where: all ? {} : { userId: auth.user.id },
        select: { ...TOKEN_SELECT, ...(all && { user: { select: { email: true, name: true } } }) },
        orderBy: { createdAt: "desc" },
    });
    return new Response(JSON.stringify(tokens.map(serialize)), {
        status: 200,
        headers: { "Content-Type": "application/json" },
    });
}

export async function POST(request) {
    const { auth, response } = await requireAuth(request, "read");
    if (response) return response;
    if (auth.via !== "session") return jsonError(403, "Token management requires an interactive session");

    let body = {};
    try {
        body = await request.json();
    } catch {
        body = {};
    }

    const name = typeof body?.name === "string" && body.name.trim() ? body.name.trim().slice(0, 100) : "API token";
    const parsed = parseScopes(body?.scopes ?? ["read"]);
    if (parsed.error) return jsonError(400, parsed.error);

    const allowed = scopesForRole(auth.user.role);
    const exceeding = parsed.scopes.filter((s) => !allowed.includes(s));
    if (exceeding.length) {
        return jsonError(403, `Your role cannot grant scope(s): ${exceeding.join(", ")}`);
    }

    let expiresAt = null;
    if (body?.expiresInDays !== undefined && body?.expiresInDays !== null && body?.expiresInDays !== "") {
        const days = Number(body.expiresInDays);
        if (!Number.isFinite(days) || days <= 0 || days > 3650) {
            return jsonError(400, "expiresInDays must be between 1 and 3650");
        }
        expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    }

    // SSO users: tokens must expire (the IdP cannot revoke them), within OIDC_TOKEN_MAX_DAYS.
    const config = getOidcConfig();
    if (config && (await isSsoUser(auth.user.id))) {
        const days = expiresAt ? Number(body.expiresInDays) : null;
        if (days === null || days > config.tokenMaxDays) {
            return jsonError(400, `API tokens of SSO users must expire within ${config.tokenMaxDays} days`);
        }
    }

    const raw = generateToken();
    try {
        const created = await prisma.apiToken.create({
            data: {
                name,
                tokenHash: hashToken(raw),
                prefix: raw.slice(0, 10),
                scopes: parsed.scopes.join(","),
                expiresAt,
                userId: auth.user.id,
            },
            select: TOKEN_SELECT,
        });

        await logTokenCreated({ token: created, userId: auth.user.id, req: request });

        // `token` is the raw secret. It is never retrievable again.
        return new Response(JSON.stringify({ ...serialize(created), token: raw }), {
            status: 201,
            headers: { "Content-Type": "application/json" },
        });
    } catch (error) {
        console.error("Error creating API token", error);
        return jsonError(500, "Could not create token");
    }
}
