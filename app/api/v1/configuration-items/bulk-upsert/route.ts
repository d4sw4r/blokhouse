// POST /api/v1/configuration-items/bulk-upsert
//
// Upsert up to 1000 items in one atomic transaction: either all items are
// written or none. Each item says how it is matched ("name" or "externalId").
// Typical use: an inventory sync job reporting every host it knows.
import prisma from "@/lib/prisma";
import { route, json, readJson, validate, ApiError } from "@/lib/api/v1/http";
import { BulkUpsertRequest } from "@/lib/api/v1/schemas";
import { upsertItemTx, type Identity } from "@/lib/api/v1/items";

export const POST = route("write", async ({ req, auth }) => {
    const { items } = validate(BulkUpsertRequest, await readJson(req, 20 * 1024 * 1024));

    // Reject duplicate identities up front; they would silently overwrite each other.
    const seen = new Map<string, number>();
    const dupes: { path: string; message: string }[] = [];
    items.forEach((item, i) => {
        const key = item.match === "name" ? `name:${item.name}` : `ext:${item.source}\u0000${item.externalId}`;
        if (seen.has(key)) dupes.push({ path: `items.${i}`, message: `same identity as items.${seen.get(key)}` });
        else seen.set(key, i);
    });
    if (dupes.length) throw new ApiError("validation_failed", "Duplicate items in request", dupes);

    const results = await prisma.$transaction(
        async (tx) => {
            const out: { index: number; result: "created" | "updated"; id: string }[] = [];
            for (const [index, { match, ...input }] of items.entries()) {
                const identity: Identity =
                    match === "name"
                        ? { by: "name", name: input.name! }
                        : { by: "externalId", source: input.source!, externalId: input.externalId! };
                const r = await upsertItemTx(tx, identity, input, { userId: auth.user.id, pathPrefix: `items.${index}.` });
                out.push({ index, ...r });
            }
            return out;
        },
        { timeout: 300_000, maxWait: 10_000 }
    );

    const created = results.filter((r) => r.result === "created").length;
    const updated = results.length - created;

    // One audit row per item, written in a single statement.
    await prisma.auditLog.createMany({
        data: results.map((r) => ({
            action: r.result === "created" ? "CREATE" : "UPDATE",
            entityType: "ConfigurationItem",
            entityId: r.id,
            userId: auth.user.id,
            description: `${r.result === "created" ? "Created" : "Updated"} via API v1 bulk upsert (${auth.via})`,
            ipAddress: (req.headers.get("x-forwarded-for") || "unknown").split(",")[0].trim(),
            userAgent: req.headers.get("user-agent") || "unknown",
        })),
    });

    return json({ data: results, meta: { created, updated } });
});
