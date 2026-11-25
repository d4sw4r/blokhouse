// GET /api/v1/webhooks/{id}/deliveries   delivery log, newest first (?status=failed, paginated)
import prisma from "@/lib/prisma";
import { route, json, pagination, pageMeta, ApiError } from "@/lib/api/v1/http";
import { mustFindWebhook, serializeDelivery } from "@/lib/api/v1/webhooks";

type Params = { id: string };
const STATUSES = ["pending", "success", "failed"];

export const GET = route<Params>("admin", async ({ req, params }) => {
    await mustFindWebhook(params.id);
    const url = new URL(req.url);
    const { page, perPage } = pagination(url);
    const status = url.searchParams.get("status");
    if (status && !STATUSES.includes(status)) {
        throw new ApiError("validation_failed", "Invalid status", [{ path: "status", message: `one of ${STATUSES.join(", ")}` }]);
    }
    const where = { webhookId: params.id, ...(status && { status }) };
    const [rows, total] = await Promise.all([
        prisma.webhookDelivery.findMany({
            where,
            orderBy: [{ createdAt: "desc" }, { id: "desc" }],
            skip: (page - 1) * perPage,
            take: perPage,
        }),
        prisma.webhookDelivery.count({ where }),
    ]);
    return json({ data: rows.map((d) => serializeDelivery(d, true)), meta: pageMeta(page, perPage, total) });
});
