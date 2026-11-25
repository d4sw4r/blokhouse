// POST /api/v1/webhooks/{id}/ping   send a test event now and return the delivery result
import prisma from "@/lib/prisma";
import { route, json } from "@/lib/api/v1/http";
import { mustFindWebhook, serializeDelivery } from "@/lib/api/v1/webhooks";
import { queuePing, deliverNow } from "@/lib/webhooks";

type Params = { id: string };

export const POST = route<Params>("admin", async ({ auth, params }) => {
    await mustFindWebhook(params.id);
    const id = await queuePing(params.id, { userId: auth.user.id, via: auth.via });
    // Send it within this request, so the caller sees whether the receiver works.
    await deliverNow(id);
    const delivery = await prisma.webhookDelivery.findUniqueOrThrow({ where: { id } });
    return json({ data: serializeDelivery(delivery) });
});
