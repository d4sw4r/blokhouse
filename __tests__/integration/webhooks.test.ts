import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { createServer, type Server } from "http";
import type { AddressInfo } from "net";
import { createHmac } from "crypto";
import { resetDb, tokenFor, call, prisma } from "./helpers";
import * as Hooks from "@/app/api/v1/webhooks/route";
import * as Hook from "@/app/api/v1/webhooks/[id]/route";
import * as Ping from "@/app/api/v1/webhooks/[id]/ping/route";
import * as Deliveries from "@/app/api/v1/webhooks/[id]/deliveries/route";
import * as Redeliver from "@/app/api/v1/webhooks/[id]/deliveries/[deliveryId]/redeliver/route";
import * as Items from "@/app/api/v1/configuration-items/route";
import * as Item from "@/app/api/v1/configuration-items/[id]/route";
import * as ByName from "@/app/api/v1/configuration-items/by-name/[name]/route";
import * as Bulk from "@/app/api/v1/configuration-items/bulk-upsert/route";
import * as LegacyItem from "@/app/api/configuration-items/[id]/route";
import { processDueDeliveries, MAX_ATTEMPTS } from "@/lib/webhooks";

// A local receiver that records requests and answers with `status`.
type Received = { headers: Record<string, string | string[] | undefined>; body: string; json: any };
let server: Server;
let received: Received[] = [];
let status = 200;
let receiverUrl = "";

beforeAll(async () => {
    server = createServer((req, res) => {
        let body = "";
        req.on("data", (c) => (body += c));
        req.on("end", () => {
            received.push({ headers: req.headers, body, json: JSON.parse(body) });
            res.statusCode = status;
            res.end("ok");
        });
    });
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
    receiverUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/hook`;
});
afterAll(async () => {
    server.close();
    await prisma.$disconnect();
});

let admin: string;
let writer: string;
beforeEach(async () => {
    await resetDb();
    received = [];
    status = 200;
    admin = (await tokenFor("ADMIN", ["read", "write", "admin"])).token;
    writer = (await tokenFor("API", ["read", "write"])).token;
});

async function createHook(body: object = {}) {
    const r = await call(Hooks.POST, { token: admin, url: "/api/v1/webhooks", body: { name: "test", url: receiverUrl, ...body } });
    expect(r.status).toBe(201);
    return r.body.data as { id: string; secret: string };
}

const events = () => received.map((r) => r.json.event);

describe("webhook management", () => {
    it("returns the secret only on creation and rotation", async () => {
        const hook = await createHook();
        expect(hook.secret).toMatch(/^whsec_[0-9a-f]{64}$/);
        const get = await call(Hook.GET, { token: admin, params: { id: hook.id } });
        expect(get.body.data).not.toHaveProperty("secret");
        expect(get.body.data.events).toEqual(["*"]);

        const rotated = await call(Hook.PATCH, { token: admin, method: "PATCH", params: { id: hook.id }, body: { rotateSecret: true } });
        expect(rotated.body.data.secret).toMatch(/^whsec_/);
        expect(rotated.body.data.secret).not.toBe(hook.secret);
        expect(await prisma.auditLog.count({ where: { entityType: "Webhook" } })).toBe(2);
    });

    it("is admin only", async () => {
        const r = await call(Hooks.POST, { token: writer, url: "/api/v1/webhooks", body: { name: "x", url: receiverUrl } });
        expect(r.status).toBe(403);
        expect((await call(Hooks.GET, { token: writer })).status).toBe(403);
    });

    it("validates URL and events", async () => {
        const bad = await call(Hooks.POST, {
            token: admin,
            body: { name: "x", url: "ftp://example.com", events: ["item.exploded"] },
        });
        expect(bad.status).toBe(400);
        expect(bad.body.error.details.map((d: { path: string }) => d.path).sort()).toEqual(["events.0", "url"]);
        const creds = await call(Hooks.POST, { token: admin, body: { name: "x", url: "https://user:pw@example.com/" } });
        expect(creds.status).toBe(400);
    });
});

describe("delivery", () => {
    it("sends signed item.created, item.updated and item.deleted events", async () => {
        const hook = await createHook();
        const created = await call(Items.POST, { token: writer, body: { name: "web-01", ip: "10.0.0.1", tags: ["prod"] } });
        const id = created.body.data.id;
        await call(Item.PATCH, { token: writer, method: "PATCH", params: { id }, body: { ip: "10.0.0.2" } });
        await call(Item.DELETE, { token: writer, method: "DELETE", params: { id } });
        await processDueDeliveries();

        expect(events()).toEqual(["item.created", "item.updated", "item.deleted"]);
        const [c, u, d] = received;

        // Signature over "<timestamp>.<body>"
        const ts = c.headers["x-blokhouse-timestamp"] as string;
        const expected = "sha256=" + createHmac("sha256", hook.secret).update(`${ts}.${c.body}`).digest("hex");
        expect(c.headers["x-blokhouse-signature"]).toBe(expected);
        expect(c.headers["x-blokhouse-event"]).toBe("item.created");
        expect(c.headers["x-blokhouse-delivery"]).toMatch(/^c/);
        expect(c.json.data.item).toMatchObject({ id, name: "web-01", ip: "10.0.0.1", tags: ["prod"] });
        expect(c.json.actor.via).toBe("token");

        expect(u.json.data.changes).toEqual(["ip"]);
        expect(u.json.data.previous.ip).toBe("10.0.0.1");
        expect(u.json.data.item.ip).toBe("10.0.0.2");

        expect(d.json.data.item).toBeNull();
        expect(d.json.data.previous).toMatchObject({ id, ip: "10.0.0.2" });

        const log = await call(Deliveries.GET, { token: admin, params: { id: hook.id } });
        expect(log.body.data.map((x: { status: string }) => x.status)).toEqual(["success", "success", "success"]);
        expect(log.body.data[0].payload.event).toBe("item.deleted");
    });

    it("skips upserts and updates that change nothing", async () => {
        await createHook();
        const put = (body: object) => call(ByName.PUT, { token: writer, method: "PUT", url: "/api/v1/configuration-items/by-name/web-01", body });
        await put({ ip: "10.0.0.1" });
        await put({ ip: "10.0.0.1" }); // unchanged
        const id = (await prisma.configurationItem.findFirstOrThrow()).id;
        await call(Item.PATCH, { token: writer, method: "PATCH", params: { id }, body: { ip: "10.0.0.1" } });
        await processDueDeliveries();
        expect(events()).toEqual(["item.created"]);
    });

    it("honours the event filter and the active flag", async () => {
        await createHook({ events: ["item.deleted"] });
        await createHook({ name: "off", active: false });
        const created = await call(Items.POST, { token: writer, body: { name: "x" } });
        await call(Item.DELETE, { token: writer, method: "DELETE", params: { id: created.body.data.id } });
        await processDueDeliveries();
        expect(events()).toEqual(["item.deleted"]);
    });

    it("sends one event per changed item of a bulk upsert", async () => {
        await createHook();
        await call(ByName.PUT, { token: writer, method: "PUT", url: "/api/v1/configuration-items/by-name/a", body: { ip: "10.0.0.1" } });
        await processDueDeliveries();
        received = [];
        await call(Bulk.POST, {
            token: writer,
            body: { items: [{ name: "a", ip: "10.0.0.1" }, { name: "b" }, { name: "c" }] },
        });
        await processDueDeliveries();
        expect(events().sort()).toEqual(["item.created", "item.created"]);
    });

    it("covers the legacy API too", async () => {
        await createHook();
        const created = await call(Items.POST, { token: writer, body: { name: "legacy", ip: "10.0.0.1" } });
        const id = created.body.data.id;
        const req = new Request(`http://localhost/api/configuration-items/${id}`, {
            method: "PUT",
            headers: { authorization: `Bearer ${writer}`, "content-type": "application/json" },
            body: JSON.stringify({ name: "legacy", ip: "10.0.0.9", status: "MAINTENANCE" }),
        });
        expect((await LegacyItem.PUT(req, { params: Promise.resolve({ id }) })).status).toBe(200);
        await processDueDeliveries();
        expect(events()).toEqual(["item.created", "item.updated"]);
        expect(received[1].json.data.changes.sort()).toEqual(["ip", "status"]);
    });
});

describe("retries", () => {
    const makeDue = () => prisma.webhookDelivery.updateMany({ where: { status: "pending" }, data: { nextAttemptAt: new Date(0) } });

    it("retries with backoff and gives up after the last attempt", async () => {
        const hook = await createHook();
        status = 500;
        await call(Items.POST, { token: writer, body: { name: "x" } });
        await processDueDeliveries();

        let d = await prisma.webhookDelivery.findFirstOrThrow();
        expect(d).toMatchObject({ status: "pending", attempts: 1, responseStatus: 500, error: "HTTP 500" });
        expect(d.nextAttemptAt.getTime()).toBeGreaterThan(Date.now() + 20_000);

        await processDueDeliveries(); // not due yet
        expect(received).toHaveLength(1);

        for (let i = 2; i <= MAX_ATTEMPTS; i++) {
            await makeDue();
            await processDueDeliveries();
        }
        d = await prisma.webhookDelivery.findFirstOrThrow();
        expect(d).toMatchObject({ status: "failed", attempts: MAX_ATTEMPTS });
        expect(received).toHaveLength(MAX_ATTEMPTS);

        // A manual redelivery works once the receiver is fixed
        status = 200;
        const r = await call(Redeliver.POST, { token: admin, method: "POST", params: { id: hook.id, deliveryId: d.id } });
        expect(r.body.data.status).toBe("success");
    });

    it("records connection errors", async () => {
        // A port nothing listens on
        const probe = createServer();
        await new Promise<void>((r) => probe.listen(0, "127.0.0.1", r));
        const port = (probe.address() as AddressInfo).port;
        await new Promise((r) => probe.close(r));
        const hook = await createHook({ url: `http://127.0.0.1:${port}/unreachable` });
        const r = await call(Ping.POST, { token: admin, method: "POST", params: { id: hook.id } });
        expect(r.status).toBe(200);
        expect(r.body.data).toMatchObject({ status: "pending", attempts: 1, responseStatus: null });
        expect(r.body.data.error).toMatch(/ECONNREFUSED/);
    });

    it("sends each delivery once when several workers run", async () => {
        await createHook();
        for (let i = 0; i < 15; i++) await call(Items.POST, { token: writer, body: { name: `n${i}` } });
        await Promise.all([processDueDeliveries(), processDueDeliveries(), processDueDeliveries()]);
        expect(received).toHaveLength(15);
        expect(new Set(received.map((r) => r.headers["x-blokhouse-delivery"])).size).toBe(15);
    });
});

describe("ping", () => {
    it("delivers a ping right away", async () => {
        const hook = await createHook({ events: ["item.deleted"] });
        const r = await call(Ping.POST, { token: admin, method: "POST", params: { id: hook.id } });
        expect(r.body.data).toMatchObject({ event: "ping", status: "success", responseStatus: 200 });
        expect(events()).toEqual(["ping"]);
    });
});
