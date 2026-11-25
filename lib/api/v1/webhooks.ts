// Serialization and lookup for the /api/v1/webhooks routes.
import prisma from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit";
import { parseEvents } from "@/lib/webhooks";
import { ApiError } from "./http";

type WebhookRow = {
    id: string;
    name: string;
    url: string;
    events: string;
    active: boolean;
    createdAt: Date;
    updatedAt: Date;
    deliveries?: { status: string; responseStatus: number | null; createdAt: Date }[];
};

export const LAST_DELIVERY = {
    deliveries: {
        orderBy: { createdAt: "desc" as const },
        take: 1,
        select: { status: true, responseStatus: true, createdAt: true },
    },
};

export function serializeWebhook(w: WebhookRow, secret?: string) {
    const last = w.deliveries?.[0];
    return {
        id: w.id,
        name: w.name,
        url: w.url,
        events: parseEvents(w.events),
        active: w.active,
        ...(secret ? { secret } : {}),
        lastDelivery: last ? { status: last.status, responseStatus: last.responseStatus, createdAt: last.createdAt.toISOString() } : null,
        createdAt: w.createdAt.toISOString(),
        updatedAt: w.updatedAt.toISOString(),
    };
}

type DeliveryRow = {
    id: string;
    event: string;
    status: string;
    attempts: number;
    responseStatus: number | null;
    error: string | null;
    durationMs: number | null;
    nextAttemptAt: Date;
    deliveredAt: Date | null;
    createdAt: Date;
    payload?: string;
};

export function serializeDelivery(d: DeliveryRow, withPayload = false) {
    return {
        id: d.id,
        event: d.event,
        status: d.status,
        attempts: d.attempts,
        responseStatus: d.responseStatus,
        error: d.error,
        durationMs: d.durationMs,
        nextAttemptAt: d.status === "pending" ? d.nextAttemptAt.toISOString() : null,
        deliveredAt: d.deliveredAt ? d.deliveredAt.toISOString() : null,
        createdAt: d.createdAt.toISOString(),
        ...(withPayload && d.payload ? { payload: JSON.parse(d.payload) } : {}),
    };
}

export async function mustFindWebhook(id: string) {
    const w = await prisma.webhook.findUnique({ where: { id }, include: LAST_DELIVERY });
    if (!w) throw new ApiError("not_found", `Webhook '${id}' not found`);
    return w;
}

/** Audit webhook changes (without the secret). */
export async function auditWebhook(
    action: "CREATE" | "UPDATE" | "DELETE",
    w: { id: string; name: string; url: string; events: string; active: boolean },
    userId: string,
    req: Request,
    extra = ""
) {
    await createAuditLog({
        action,
        entityType: "Webhook",
        entityId: w.id,
        userId,
        description: `${action === "CREATE" ? "Created" : action === "UPDATE" ? "Updated" : "Deleted"} webhook "${w.name}"${extra}`,
        newValues: action === "DELETE" ? undefined : { name: w.name, url: w.url, events: w.events, active: w.active },
        req,
    });
}
