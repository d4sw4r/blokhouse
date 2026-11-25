// GET    /api/v1/webhooks/{id}
// PATCH  /api/v1/webhooks/{id}   change fields; rotateSecret returns a new secret once
// DELETE /api/v1/webhooks/{id}   also deletes its delivery log
import prisma from "@/lib/prisma";
import { route, json, readJson, validate } from "@/lib/api/v1/http";
import { WebhookPatch } from "@/lib/api/v1/schemas";
import { LAST_DELIVERY, serializeWebhook, mustFindWebhook, auditWebhook } from "@/lib/api/v1/webhooks";
import { generateSecret } from "@/lib/webhooks";

type Params = { id: string };

export const GET = route<Params>("admin", async ({ params }) => {
    return json({ data: serializeWebhook(await mustFindWebhook(params.id)) });
});

export const PATCH = route<Params>("admin", async ({ req, auth, params }) => {
    const input = validate(WebhookPatch, await readJson(req));
    await mustFindWebhook(params.id);
    const secret = input.rotateSecret ? generateSecret() : undefined;
    const updated = await prisma.webhook.update({
        where: { id: params.id },
        data: {
            ...(input.name !== undefined && { name: input.name }),
            ...(input.url !== undefined && { url: input.url }),
            ...(input.events !== undefined && { events: [...new Set(input.events)].join(",") }),
            ...(input.active !== undefined && { active: input.active }),
            ...(secret && { secret }),
        },
        include: LAST_DELIVERY,
    });
    await auditWebhook("UPDATE", updated, auth.user.id, req, secret ? " (secret rotated)" : "");
    return json({ data: serializeWebhook(updated, secret) });
});

export const DELETE = route<Params>("admin", async ({ req, auth, params }) => {
    const w = await mustFindWebhook(params.id);
    await prisma.webhook.delete({ where: { id: params.id } });
    await auditWebhook("DELETE", w, auth.user.id, req);
    return new Response(null, { status: 204 });
});
