// GET  /api/v1/webhooks   list webhooks (admin)
// POST /api/v1/webhooks   create; the response contains the signing secret, once
import prisma from "@/lib/prisma";
import { route, json, readJson, validate } from "@/lib/api/v1/http";
import { WebhookCreate } from "@/lib/api/v1/schemas";
import { LAST_DELIVERY, serializeWebhook, auditWebhook } from "@/lib/api/v1/webhooks";
import { generateSecret } from "@/lib/webhooks";

export const GET = route("admin", async () => {
    const hooks = await prisma.webhook.findMany({ include: LAST_DELIVERY, orderBy: { createdAt: "asc" } });
    return json({ data: hooks.map((w) => serializeWebhook(w)) });
});

export const POST = route("admin", async ({ req, auth }) => {
    const input = validate(WebhookCreate, await readJson(req));
    const secret = generateSecret();
    const created = await prisma.webhook.create({
        data: {
            name: input.name,
            url: input.url,
            events: [...new Set(input.events)].join(","),
            active: input.active,
            secret,
            createdById: auth.user.id,
        },
        include: LAST_DELIVERY,
    });
    await auditWebhook("CREATE", created, auth.user.id, req);
    return json({ data: serializeWebhook(created, secret) }, 201, { Location: `/api/v1/webhooks/${created.id}` });
});
