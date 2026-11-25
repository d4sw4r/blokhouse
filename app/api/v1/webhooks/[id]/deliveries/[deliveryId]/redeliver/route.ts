// POST /api/v1/webhooks/{id}/deliveries/{deliveryId}/redeliver   send a delivery again now
// (also a failed or successful one; a pending one that is being sent right now is left alone)
import prisma from "@/lib/prisma";
import { route, json, ApiError } from "@/lib/api/v1/http";
import { serializeDelivery } from "@/lib/api/v1/webhooks";
import { deliverNow } from "@/lib/webhooks";

type Params = { id: string; deliveryId: string };

export const POST = route<Params>("admin", async ({ params }) => {
    const d = await prisma.webhookDelivery.findFirst({ where: { id: params.deliveryId, webhookId: params.id } });
    if (!d) throw new ApiError("not_found", `Delivery '${params.deliveryId}' not found`);
    await deliverNow(d.id);
    return json({ data: serializeDelivery(await prisma.webhookDelivery.findUniqueOrThrow({ where: { id: d.id } }), true) });
});
