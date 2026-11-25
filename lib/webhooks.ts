// lib/webhooks.ts
// Outgoing webhooks.
//
// Routes call emitItemEvent() after a change is committed. That stores one
// WebhookDelivery per matching webhook (an outbox), and a worker in the server
// process sends them: signed POST, 10 s timeout, retried with backoff. Several
// app replicas can run workers; each delivery is claimed with
// FOR UPDATE SKIP LOCKED, so it is sent by one of them.
//
// Receivers verify the signature like this (Node):
//   const expected = "sha256=" + createHmac("sha256", secret)
//       .update(`${req.headers["x-blokhouse-timestamp"]}.${rawBody}`).digest("hex");
//   timingSafeEqual(Buffer.from(expected), Buffer.from(req.headers["x-blokhouse-signature"]))
import { createHmac, randomBytes, randomUUID } from "crypto";
import prisma from "@/lib/prisma";
import { loadItem, serializeItem } from "@/lib/api/v1/items";
import { WEBHOOK_EVENTS } from "@/lib/api/v1/schemas";
import pkg from "@/package.json";

export const ITEM_EVENTS = WEBHOOK_EVENTS;
export type ItemEvent = (typeof ITEM_EVENTS)[number];
export type SerializedItem = ReturnType<typeof serializeItem>;
export type Actor = { userId?: string | null; via?: string };

export const MAX_ATTEMPTS = 6;
/** Wait before attempt 2, 3, ... (attempt 1 is immediate). */
export const RETRY_DELAYS_MS = [30_000, 2 * 60_000, 10 * 60_000, 60 * 60_000, 6 * 60 * 60_000];
const TIMEOUT_MS = 10_000;
const POLL_MS = 5_000;
const BATCH = 20;
const KEEP_SUCCESS_DAYS = 14;
const KEEP_FAILED_DAYS = 30;

export function generateSecret(): string {
    return "whsec_" + randomBytes(32).toString("hex");
}

/** Signature header value for a body sent at `timestamp` (Unix seconds). */
export function sign(secret: string, timestamp: number, body: string): string {
    return "sha256=" + createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
}

export function parseEvents(events: string): string[] {
    return events.split(",").map((e) => e.trim()).filter(Boolean);
}

export function subscribes(events: string, event: string): boolean {
    const list = parseEvents(events);
    return list.includes("*") || list.includes(event);
}

const TIMESTAMPS = new Set(["createdAt", "updatedAt", "lastSeenAt"]);

/** Top-level fields that differ between two item versions (timestamps ignored). */
export function changedFields(previous: SerializedItem | null, item: SerializedItem | null): string[] {
    if (!previous || !item) return [];
    return Object.keys(item).filter(
        (k) => !TIMESTAMPS.has(k) && JSON.stringify(previous[k as keyof SerializedItem]) !== JSON.stringify(item[k as keyof SerializedItem])
    );
}

/** Current state of an item in API v1 shape, or null. */
export async function itemSnapshot(id: string): Promise<SerializedItem | null> {
    const item = await loadItem(id);
    return item ? serializeItem(item) : null;
}

/**
 * State of an item before a change, for the `previous` of an event. Skips the query
 * when no webhook is active. Never throws.
 */
export async function previousForWebhooks(id: string): Promise<SerializedItem | null> {
    try {
        if (!(await prisma.webhook.count({ where: { active: true } }))) return null;
        return await itemSnapshot(id);
    } catch {
        return null;
    }
}

type EventInput = { id?: string; item?: SerializedItem | null; previous?: SerializedItem | null; actor?: Actor };

/**
 * Queue an item event for all active webhooks that subscribe to it.
 * Call it after the change is committed. Never throws: webhooks must not break writes.
 *
 * item.created / item.updated: pass the item id (its current state is loaded) or the
 * item, and for updates `previous`. An update that changed nothing is not sent.
 * item.deleted: pass `previous`, the state before deletion.
 */
export async function emitItemEvent(event: ItemEvent, opts: EventInput): Promise<void> {
    await emitItemEvents([{ event, ...opts }]);
}

/** Queue several item events at once (bulk operations). */
export async function emitItemEvents(events: (EventInput & { event: ItemEvent })[]): Promise<void> {
    try {
        if (!events.length) return;
        const webhooks = await prisma.webhook.findMany({ where: { active: true }, select: { id: true, events: true } });
        if (!webhooks.length) return;

        const rows: { webhookId: string; event: string; payload: string }[] = [];
        for (const e of events) {
            const targets = webhooks.filter((w) => subscribes(w.events, e.event));
            if (!targets.length) continue;
            const item = e.event === "item.deleted" ? null : (e.item ?? (e.id ? await itemSnapshot(e.id) : null));
            const previous = e.previous ?? null;
            if (e.event !== "item.deleted" && !item) continue; // deleted in the meantime
            const changes = e.event === "item.updated" ? changedFields(previous, item) : [];
            if (e.event === "item.updated" && previous && !changes.length) continue;

            const payload = JSON.stringify({
                id: `evt_${randomUUID()}`,
                event: e.event,
                occurredAt: new Date().toISOString(),
                data: { item, previous, changes },
                actor: { userId: e.actor?.userId ?? null, via: e.actor?.via ?? null },
            });
            for (const w of targets) rows.push({ webhookId: w.id, event: e.event, payload });
        }
        if (!rows.length) return;
        await prisma.webhookDelivery.createMany({ data: rows });
        kick();
    } catch (error) {
        console.error("[webhooks] could not queue events", error);
    }
}

/** Queue a "ping" for one webhook, regardless of its event filter. Returns the delivery id. */
export async function queuePing(webhookId: string, actor?: Actor): Promise<string> {
    const payload = JSON.stringify({
        id: `evt_${randomUUID()}`,
        event: "ping",
        occurredAt: new Date().toISOString(),
        data: { message: "Blokhouse webhook test" },
        actor: { userId: actor?.userId ?? null, via: actor?.via ?? null },
    });
    const delivery = await prisma.webhookDelivery.create({ data: { webhookId, event: "ping", payload } });
    return delivery.id;
}

// ---------------------------------------------------------------------------
// Delivery
// ---------------------------------------------------------------------------

type Claimed = { id: string; webhookId: string; createdAt: Date };

/** Claim due deliveries (marks the attempt and sets a lease), oldest first. */
async function claim(limit: number): Promise<Claimed[]> {
    // The lease (2 minutes) makes a claimed delivery due again if the process dies mid-send.
    const rows = await prisma.$queryRaw<Claimed[]>`
        UPDATE "WebhookDelivery" SET "attempts" = "attempts" + 1, "nextAttemptAt" = NOW() + interval '2 minutes'
        WHERE "id" IN (
          SELECT "id" FROM "WebhookDelivery"
          WHERE "status" = 'pending' AND "nextAttemptAt" <= NOW()
          ORDER BY "createdAt" LIMIT ${limit}
          FOR UPDATE SKIP LOCKED)
        RETURNING "id", "webhookId", "createdAt"`;
    return rows.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
}

async function deliver(id: string): Promise<void> {
    const d = await prisma.webhookDelivery.findUnique({ where: { id }, include: { webhook: true } });
    if (!d) return;
    if (!d.webhook.active) {
        await prisma.webhookDelivery.update({ where: { id }, data: { status: "failed", error: "webhook is disabled" } });
        return;
    }

    const timestamp = Math.floor(Date.now() / 1000);
    const started = Date.now();
    let responseStatus: number | null = null;
    let error: string | null = null;
    try {
        const res = await fetch(d.webhook.url, {
            method: "POST",
            redirect: "manual",
            signal: AbortSignal.timeout(TIMEOUT_MS),
            headers: {
                "content-type": "application/json",
                "user-agent": `Blokhouse-Webhook/${pkg.version}`,
                "x-blokhouse-event": d.event,
                "x-blokhouse-delivery": d.id,
                "x-blokhouse-timestamp": String(timestamp),
                "x-blokhouse-signature": sign(d.webhook.secret, timestamp, d.payload),
            },
            body: d.payload,
        });
        responseStatus = res.status;
        await res.body?.cancel().catch(() => {});
        if (res.status < 200 || res.status > 299) error = `HTTP ${res.status}`;
    } catch (e) {
        const err = e as Error & { cause?: { code?: string; message?: string } };
        error = err.name === "TimeoutError" ? `timeout after ${TIMEOUT_MS / 1000}s` : (err.cause?.code ?? err.cause?.message ?? err.message);
    }
    const durationMs = Date.now() - started;

    if (!error) {
        await prisma.webhookDelivery.update({
            where: { id },
            data: { status: "success", responseStatus, error: null, durationMs, deliveredAt: new Date() },
        });
        return;
    }
    const retry = d.attempts < MAX_ATTEMPTS;
    await prisma.webhookDelivery.update({
        where: { id },
        data: {
            status: retry ? "pending" : "failed",
            responseStatus,
            error: error.slice(0, 500),
            durationMs,
            nextAttemptAt: retry ? new Date(Date.now() + RETRY_DELAYS_MS[d.attempts - 1]) : undefined,
        },
    });
}

/**
 * Send all deliveries that are due. Returns how many were attempted.
 * Webhooks are served in parallel; each webhook gets its events in order (oldest
 * first), unless an earlier one is waiting for a retry.
 */
export async function processDueDeliveries(): Promise<number> {
    let total = 0;
    for (;;) {
        const claimed = await claim(BATCH);
        if (!claimed.length) return total;
        const byWebhook = new Map<string, string[]>();
        for (const c of claimed) byWebhook.set(c.webhookId, [...(byWebhook.get(c.webhookId) ?? []), c.id]);
        await Promise.all(
            [...byWebhook.values()].map(async (ids) => {
                for (const id of ids) await deliver(id).catch((e) => console.error("[webhooks] delivery", id, e));
            })
        );
        total += claimed.length;
    }
}

/** Send one delivery now, in this request (ping, redeliver). Also retries a failed one. */
export async function deliverNow(id: string): Promise<void> {
    const claimed = await prisma.webhookDelivery.updateMany({
        where: { id, OR: [{ status: "failed" }, { status: "pending", nextAttemptAt: { lte: new Date() } }, { status: "success" }] },
        data: { status: "pending", attempts: { increment: 1 }, nextAttemptAt: new Date(Date.now() + 2 * 60_000) },
    });
    if (claimed.count) await deliver(id);
}

async function cleanup() {
    const day = 24 * 60 * 60 * 1000;
    await prisma.webhookDelivery.deleteMany({
        where: {
            OR: [
                { status: "success", createdAt: { lt: new Date(Date.now() - KEEP_SUCCESS_DAYS * day) } },
                { status: "failed", createdAt: { lt: new Date(Date.now() - KEEP_FAILED_DAYS * day) } },
            ],
        },
    });
}

// ---------------------------------------------------------------------------
// Worker (started from instrumentation.ts)
// ---------------------------------------------------------------------------

const state = globalThis as unknown as { __blokhouseWebhooks?: { running: boolean; again: boolean; timer?: NodeJS.Timeout } };

async function tick() {
    const s = (state.__blokhouseWebhooks ??= { running: false, again: false });
    if (s.running) {
        s.again = true;
        return;
    }
    s.running = true;
    try {
        do {
            s.again = false;
            await processDueDeliveries();
        } while (s.again);
    } catch (error) {
        console.error("[webhooks] worker", error);
    } finally {
        s.running = false;
    }
}

/** Process right away instead of at the next poll (only where the worker runs). */
function kick() {
    if (state.__blokhouseWebhooks?.timer) setImmediate(tick);
}

export function startWebhookWorker() {
    const s = (state.__blokhouseWebhooks ??= { running: false, again: false });
    if (s.timer) return;
    s.timer = setInterval(tick, POLL_MS);
    s.timer.unref();
    const cleaner = setInterval(() => cleanup().catch((e) => console.error("[webhooks] cleanup", e)), 60 * 60 * 1000);
    cleaner.unref();
    setImmediate(tick);
}
