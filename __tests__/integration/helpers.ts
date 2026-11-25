// Shared helpers for integration tests (real PostgreSQL, no database mocks).
import prisma from "@/lib/prisma";
import { generateToken, hashToken } from "@/lib/auth";

if (!process.env.DATABASE_URL?.startsWith("postgres")) {
    throw new Error("Integration tests need DATABASE_URL=postgresql://… (a throwaway database)");
}

const TABLES = [
    "WebhookDelivery", "Webhook", "AuditLog", "Notification", "FavoriteItem", "MaintenanceSchedule", "CustomFieldValue",
    "CustomField", "AssetRelation", "_ConfigurationItemToTag", "ConfigurationItem", "Tag",
    "ItemType", "ApiToken", "Session", "Account", "VerificationToken", "User",
];

export async function resetDb() {
    await prisma.$executeRawUnsafe(`TRUNCATE ${TABLES.map((t) => `"${t}"`).join(", ")} CASCADE`);
}

/** Create a user with the given role and an API token with the given scopes. */
export async function tokenFor(role = "API", scopes = ["read", "write"]) {
    const user = await prisma.user.create({
        data: { email: `${role.toLowerCase()}-${Math.random().toString(36).slice(2)}@test.io`, role },
    });
    const raw = generateToken();
    await prisma.apiToken.create({
        data: { name: "test", tokenHash: hashToken(raw), prefix: raw.slice(0, 10), scopes: scopes.join(","), userId: user.id },
    });
    return { token: raw, user };
}

/** Call a route handler like Next.js would. */
export async function call<P>(
    handler: (req: Request, ctx?: { params?: Promise<P> }) => Promise<Response>,
    opts: { token?: string; method?: string; url?: string; body?: unknown; params?: Record<string, string>; raw?: string } = {}
) {
    const headers: Record<string, string> = { "content-type": "application/json" };
    if (opts.token) headers.authorization = `Bearer ${opts.token}`;
    const req = new Request(`http://localhost${opts.url ?? "/api/v1/x"}`, {
        method: opts.method ?? (opts.body !== undefined || opts.raw !== undefined ? "POST" : "GET"),
        headers,
        body: opts.raw ?? (opts.body !== undefined ? JSON.stringify(opts.body) : undefined),
    });
    const res = await handler(req, { params: Promise.resolve((opts.params ?? {}) as P) });
    const text = await res.text();
    return { status: res.status, body: text ? JSON.parse(text) : null, headers: res.headers };
}

export { prisma };
