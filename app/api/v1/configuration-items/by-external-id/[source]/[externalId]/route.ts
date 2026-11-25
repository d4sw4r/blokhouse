// GET /api/v1/configuration-items/by-external-id/{source}/{externalId}
// PUT /api/v1/configuration-items/by-external-id/{source}/{externalId}   upsert
//
// Stable identity for automation, e.g. source "puppet" + certname, or
// source "vmware" + instance UUID. Unique per source.
import prisma from "@/lib/prisma";
import { route, json, readJson, validate, ApiError, pathSegments } from "@/lib/api/v1/http";
import { ItemUpsert } from "@/lib/api/v1/schemas";
import { TX_OPTIONS, upsertItemTx, findByIdentity, loadItem, serializeItem, audit, type Identity } from "@/lib/api/v1/items";

// Read from the raw path (see pathSegments): Next.js' own decoding of dynamic
// segments breaks values containing "%".
function identityFrom(req: Request): Identity {
    const [source, externalId] = pathSegments(req, 2);
    return { by: "externalId", source, externalId };
}

export const GET = route("read", async ({ req }) => {
    const id = identityFrom(req);
    const found = await findByIdentity(prisma, id);
    if (!found) throw new ApiError("not_found", "No configuration item with this source and externalId");
    return json({ data: serializeItem((await loadItem(found.id))!) });
});

export const PUT = route("write", async ({ req, auth }) => {
    const ident = identityFrom(req);
    const input = validate(ItemUpsert, await readJson(req));
    if (ident.by === "externalId" &&
        ((input.source !== undefined && input.source !== ident.source) ||
         (input.externalId !== undefined && input.externalId !== ident.externalId))) {
        throw new ApiError("validation_failed", "Body source/externalId must match the URL");
    }

    const found = await findByIdentity(prisma, ident);
    const before = found ? await loadItem(found.id) : null;
    const { id, result } = await prisma.$transaction(
        (tx) => upsertItemTx(tx, ident, input, { userId: auth.user.id }),
        TX_OPTIONS
    );
    const after = (await loadItem(id))!;
    if (result !== "unchanged") {
        await audit(result === "created" ? "CREATE" : "UPDATE", before, after, auth.user.id, req, auth.via);
    }
    return json({ result, data: serializeItem(after) }, result === "created" ? 201 : 200);
});
