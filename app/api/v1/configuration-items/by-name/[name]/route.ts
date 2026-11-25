// GET /api/v1/configuration-items/by-name/{name}
// PUT /api/v1/configuration-items/by-name/{name}   upsert (create or update)
//
// Made for automation that knows hosts by name, e.g. Ansible's inventory_hostname:
//   curl -X PUT -H "Authorization: Bearer $TOKEN" -H 'content-type: application/json' \
//     -d '{"ip":"10.0.0.5","type":"Server","tags":["prod"]}' \
//     https://cmdb/api/v1/configuration-items/by-name/web-01
import prisma from "@/lib/prisma";
import { route, json, readJson, validate, ApiError, pathSegments } from "@/lib/api/v1/http";
import { ItemUpsert } from "@/lib/api/v1/schemas";
import { TX_OPTIONS, upsertItemTx, findByIdentity, loadItem, serializeItem, audit } from "@/lib/api/v1/items";
import { emitItemEvent } from "@/lib/webhooks";

// The name is read from the raw path (see pathSegments): Next.js' own decoding
// of dynamic segments breaks names containing "%".
const nameFrom = (req: Request) => pathSegments(req, 1)[0];

export const GET = route("read", async ({ req }) => {
    const name = nameFrom(req);
    const found = await findByIdentity(prisma, { by: "name", name });
    if (!found) throw new ApiError("not_found", `No configuration item named '${name}'`);
    return json({ data: serializeItem((await loadItem(found.id))!) });
});

export const PUT = route("write", async ({ req, auth }) => {
    const name = nameFrom(req);
    const input = validate(ItemUpsert, await readJson(req));
    if (input.name !== undefined && input.name !== name) {
        throw new ApiError("validation_failed", "Body name must match the name in the URL", [
            { path: "name", message: `expected '${name}'` },
        ]);
    }

    const found = await findByIdentity(prisma, { by: "name", name });
    const before = found ? await loadItem(found.id) : null;
    const { id, result } = await prisma.$transaction(
        (tx) => upsertItemTx(tx, { by: "name", name }, input, { userId: auth.user.id }),
        TX_OPTIONS
    );
    const after = (await loadItem(id))!;
    if (result !== "unchanged") {
        await audit(result === "created" ? "CREATE" : "UPDATE", before, after, auth.user.id, req, auth.via);
        await emitItemEvent(result === "created" ? "item.created" : "item.updated", {
            item: serializeItem(after),
            previous: before ? serializeItem(before) : null,
            actor: { userId: auth.user.id, via: auth.via },
        });
    }
    return json({ result, data: serializeItem(after) }, result === "created" ? 201 : 200);
});
