// GET    /api/v1/configuration-items/{id}
// PATCH  /api/v1/configuration-items/{id}   update only the fields present
// DELETE /api/v1/configuration-items/{id}
import prisma from "@/lib/prisma";
import { route, json, readJson, validate, ApiError } from "@/lib/api/v1/http";
import { ItemPatch } from "@/lib/api/v1/schemas";
import { TX_OPTIONS, updateItemTx, loadItem, serializeItem, audit } from "@/lib/api/v1/items";
import { notifyAssetChange } from "@/lib/notifications";
import { emitItemEvent } from "@/lib/webhooks";

type Params = { id: string };

async function mustLoad(id: string) {
    const item = await loadItem(id);
    if (!item) throw new ApiError("not_found", `Configuration item '${id}' not found`);
    return item;
}

export const GET = route<Params>("read", async ({ params }) => {
    return json({ data: serializeItem(await mustLoad(params.id)) });
});

export const PATCH = route<Params>("write", async ({ req, auth, params }) => {
    const input = validate(ItemPatch, await readJson(req));
    const before = await mustLoad(params.id);
    const finalSource = input.source !== undefined ? input.source : before.source;
    const finalExternalId = input.externalId !== undefined ? input.externalId : before.externalId;
    if ((finalSource == null) !== (finalExternalId == null)) {
        throw new ApiError("validation_failed", "source and externalId must be set together", [
            { path: "externalId", message: "source and externalId must both be set or both be null" },
        ]);
    }
    await prisma.$transaction((tx) => updateItemTx(tx, before, input, { userId: auth.user.id }), TX_OPTIONS);
    const after = (await loadItem(params.id))!;
    await audit("UPDATE", before, after, auth.user.id, req, auth.via);
    await emitItemEvent("item.updated", {
        item: serializeItem(after),
        previous: serializeItem(before),
        actor: { userId: auth.user.id, via: auth.via },
    });
    if (before.status !== after.status) {
        await notifyAssetChange({
            assetId: after.id,
            assetName: after.name,
            type: "ASSET_STATUS_CHANGED",
            message: `Status changed from "${before.status}" to "${after.status}" by ${auth.user.name || auth.user.email}`,
            changedByUserId: auth.user.id,
        });
    }
    return json({ data: serializeItem(after) });
});

export const DELETE = route<Params>("write", async ({ req, auth, params }) => {
    const before = await mustLoad(params.id);
    await prisma.configurationItem.delete({ where: { id: params.id } });
    await audit("DELETE", before, null, auth.user.id, req, auth.via);
    await emitItemEvent("item.deleted", { previous: serializeItem(before), actor: { userId: auth.user.id, via: auth.via } });
    return new Response(null, { status: 204 });
});
