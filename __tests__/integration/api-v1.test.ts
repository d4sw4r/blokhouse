import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { resetDb, tokenFor, call, prisma } from "./helpers";
import * as Items from "@/app/api/v1/configuration-items/route";
import * as Item from "@/app/api/v1/configuration-items/[id]/route";
import * as ByName from "@/app/api/v1/configuration-items/by-name/[name]/route";
import * as ByExternal from "@/app/api/v1/configuration-items/by-external-id/[source]/[externalId]/route";
import * as Bulk from "@/app/api/v1/configuration-items/bulk-upsert/route";
import * as Types from "@/app/api/v1/types/route";
import * as Tags from "@/app/api/v1/tags/route";
import * as Spec from "@/app/api/v1/openapi/route";

const byName = (name: string) => `/api/v1/configuration-items/by-name/${encodeURIComponent(name)}`;
const byExt = (source: string, id: string) =>
    `/api/v1/configuration-items/by-external-id/${encodeURIComponent(source)}/${encodeURIComponent(id)}`;

let rw: string; // read + write
let ro: string; // read only

beforeEach(async () => {
    await resetDb();
    rw = (await tokenFor("API", ["read", "write"])).token;
    ro = (await tokenFor("API", ["read"])).token;
});

afterAll(async () => {
    await prisma.$disconnect();
});

describe("authentication and errors", () => {
    it("rejects missing credentials with the v1 error format", async () => {
        const r = await call(Items.GET);
        expect(r.status).toBe(401);
        expect(r.body).toEqual({ error: { code: "unauthorized", message: expect.any(String) } });
    });

    it("rejects an invalid token without falling back to anything", async () => {
        const r = await call(Items.GET, { token: "bh_nope" });
        expect(r.status).toBe(401);
    });

    it("requires the write scope to create", async () => {
        const r = await call(Items.POST, { token: ro, body: { name: "x" } });
        expect(r.status).toBe(403);
        expect(r.body.error.code).toBe("forbidden");
    });

    it("reports validation details with field paths", async () => {
        const r = await call(Items.POST, { token: rw, body: { name: "", ip: "300.1.1.1", status: "BROKEN", bogus: 1 } });
        expect(r.status).toBe(400);
        expect(r.body.error.code).toBe("validation_failed");
        const paths = r.body.error.details.map((d: { path: string }) => d.path);
        expect(paths).toEqual(expect.arrayContaining(["name", "ip", "status"]));
        expect(JSON.stringify(r.body.error.details)).toContain("bogus");
    });

    it("rejects malformed JSON", async () => {
        const r = await call(Items.POST, { token: rw, raw: "{nope" });
        expect(r.status).toBe(400);
        expect(r.body.error.code).toBe("invalid_json");
    });
});

describe("configuration items CRUD", () => {
    it("creates an item, resolving type and tags by name", async () => {
        const r = await call(Items.POST, {
            token: rw,
            body: { name: "web-01", ip: "10.0.0.1", mac: "00:11:22:33:44:55", type: "Server", tags: ["prod", "web", "PROD"] },
        });
        expect(r.status).toBe(201);
        expect(r.headers.get("location")).toBe(`/api/v1/configuration-items/${r.body.data.id}`);
        expect(r.body.data).toMatchObject({
            name: "web-01", ip: "10.0.0.1", status: "ACTIVE", type: "Server", tags: ["prod", "web"], customFields: {},
        });
        // Existing type is reused case-insensitively
        const r2 = await call(Items.POST, { token: rw, body: { name: "web-02", type: "server" } });
        expect(r2.body.data.type).toBe("Server");
        expect(await prisma.itemType.count()).toBe(1);
        expect(await prisma.tag.count()).toBe(2);
    });

    it("writes an audit entry", async () => {
        const r = await call(Items.POST, { token: rw, body: { name: "audited" } });
        const log = await prisma.auditLog.findFirst({ where: { entityId: r.body.data.id } });
        expect(log?.action).toBe("CREATE");
        expect(log?.description).toContain("API v1 (token)");
        expect(JSON.parse(log!.newValues!).name).toBe("audited");
    });

    it("lists with case-insensitive search, filters and pagination", async () => {
        for (const [name, type, tag] of [["Web-01", "Server", "prod"], ["web-02", "Server", "dev"], ["db-01", "Database", "prod"]]) {
            await call(Items.POST, { token: rw, body: { name, type, tags: [tag] } });
        }
        const q = await call(Items.GET, { token: ro, url: "/api/v1/configuration-items?q=WEB" });
        expect(q.body.data.map((i: { name: string }) => i.name)).toEqual(["Web-01", "web-02"]);

        const t = await call(Items.GET, { token: ro, url: "/api/v1/configuration-items?type=server&tag=prod" });
        expect(t.body.data.map((i: { name: string }) => i.name)).toEqual(["Web-01"]);

        const p = await call(Items.GET, { token: ro, url: "/api/v1/configuration-items?per_page=2&page=2" });
        expect(p.body.data).toHaveLength(1);
        expect(p.body.meta).toEqual({ page: 2, per_page: 2, total: 3, total_pages: 2 });
    });

    it("PATCH changes only the given fields and replaces tags", async () => {
        const c = await call(Items.POST, { token: rw, body: { name: "app", ip: "10.0.0.9", type: "Server", tags: ["a", "b"] } });
        const id = c.body.data.id;
        const r = await call(Item.PATCH, { token: rw, method: "PATCH", params: { id }, body: { status: "MAINTENANCE", tags: ["c"] } });
        expect(r.status).toBe(200);
        expect(r.body.data).toMatchObject({ name: "app", ip: "10.0.0.9", type: "Server", status: "MAINTENANCE", tags: ["c"] });

        const r2 = await call(Item.PATCH, { token: rw, method: "PATCH", params: { id }, body: { type: null, ip: null } });
        expect(r2.body.data).toMatchObject({ type: null, ip: null, tags: ["c"] });
    });

    it("PATCH rejects source without externalId", async () => {
        const c = await call(Items.POST, { token: rw, body: { name: "x" } });
        const r = await call(Item.PATCH, { token: rw, method: "PATCH", params: { id: c.body.data.id }, body: { source: "puppet" } });
        expect(r.status).toBe(400);
    });

    it("GET/DELETE by id, 404 afterwards", async () => {
        const c = await call(Items.POST, { token: rw, body: { name: "gone" } });
        const id = c.body.data.id;
        expect((await call(Item.GET, { token: ro, params: { id } })).status).toBe(200);
        expect((await call(Item.DELETE, { token: ro, method: "DELETE", params: { id } })).status).toBe(403);
        expect((await call(Item.DELETE, { token: rw, method: "DELETE", params: { id } })).status).toBe(204);
        const r = await call(Item.GET, { token: ro, params: { id } });
        expect(r.status).toBe(404);
        expect(r.body.error.code).toBe("not_found");
    });
});

describe("custom fields", () => {
    beforeEach(async () => {
        const server = await prisma.itemType.create({ data: { name: "Server" } });
        await prisma.customField.create({ data: { name: "rack_unit", label: "Rack unit", type: "NUMBER" } });
        await prisma.customField.create({ data: { name: "warranty", label: "Warranty", type: "DATE", itemTypeId: server.id } });
    });

    it("sets, normalizes and removes values by field name", async () => {
        const c = await call(Items.POST, {
            token: rw,
            body: { name: "s1", type: "Server", customFields: { rack_unit: "14", warranty: "2027-03-01T10:00:00Z" } },
        });
        expect(c.status).toBe(201);
        expect(c.body.data.customFields).toEqual({ rack_unit: "14", warranty: "2027-03-01" });

        const r = await call(Item.PATCH, { token: rw, method: "PATCH", params: { id: c.body.data.id }, body: { customFields: { rack_unit: null } } });
        expect(r.body.data.customFields).toEqual({ warranty: "2027-03-01" });
    });

    it("enforces the allowed options of a field", async () => {
        await prisma.customField.create({ data: { name: "env", label: "Env", type: "STRING", options: JSON.stringify(["prod", "dev"]) } });
        const bad = await call(Items.POST, { token: rw, body: { name: "o1", customFields: { env: "qa" } } });
        expect(bad.status).toBe(400);
        expect(bad.body.error.details[0]).toEqual({ path: "customFields.env", message: "must be one of: prod, dev" });
        const good = await call(Items.POST, { token: rw, body: { name: "o2", customFields: { env: "prod" } } });
        expect(good.body.data.customFields.env).toBe("prod");
    });

    it("rejects invalid values and fields that don't apply to the type, writing nothing", async () => {
        const r = await call(Items.POST, {
            token: rw,
            body: { name: "s2", customFields: { rack_unit: "abc", warranty: "2027-01-01", nope: "x" } },
        });
        expect(r.status).toBe(400);
        expect(r.body.error.details).toEqual(
            expect.arrayContaining([
                { path: "customFields.rack_unit", message: "must be a number" },
                { path: "customFields.warranty", message: "unknown custom field for this item type" },
                { path: "customFields.nope", message: "unknown custom field for this item type" },
            ])
        );
        expect(await prisma.configurationItem.count()).toBe(0);
    });
});

describe("upsert by name", () => {
    it("creates, then updates idempotently and marks the item as seen", async () => {
        const first = await call(ByName.PUT, { token: rw, method: "PUT", url: byName("web-01"), body: { ip: "10.0.0.1", tags: ["prod"] } });
        expect(first.status).toBe(201);
        expect(first.body.result).toBe("created");
        expect(first.body.data.lastSeenAt).not.toBeNull();

        const second = await call(ByName.PUT, { token: rw, method: "PUT", url: byName("web-01"), body: { ip: "10.0.0.2" } });
        expect(second.status).toBe(200);
        expect(second.body.result).toBe("updated");
        expect(second.body.data).toMatchObject({ id: first.body.data.id, ip: "10.0.0.2", tags: ["prod"] });
        expect(await prisma.configurationItem.count()).toBe(1);

        const get = await call(ByName.GET, { token: ro, url: byName("web-01") });
        expect(get.body.data.id).toBe(first.body.data.id);
    });

    it("reports 'unchanged' for the same state, refreshes lastSeenAt and writes no audit entry", async () => {
        await prisma.customField.create({ data: { name: "cpus", label: "CPUs", type: "NUMBER" } });
        const body = { ip: "10.0.0.1", type: "Server", tags: ["web", "Prod"], customFields: { cpus: 4 } };
        const first = await call(ByName.PUT, { token: rw, method: "PUT", url: byName("web-01"), body });
        const audits = await prisma.auditLog.count();

        // Same values, different spelling and order: still the same state.
        const again = await call(ByName.PUT, {
            token: rw, method: "PUT", url: byName("web-01"),
            body: { ...body, type: "server", tags: ["prod", "WEB"], customFields: { cpus: "4" } },
        });
        expect(again.status).toBe(200);
        expect(again.body.result).toBe("unchanged");
        expect(new Date(again.body.data.lastSeenAt).getTime()).toBeGreaterThanOrEqual(new Date(first.body.data.lastSeenAt).getTime());
        expect(await prisma.auditLog.count()).toBe(audits);

        const changed = await call(ByName.PUT, { token: rw, method: "PUT", url: byName("web-01"), body: { tags: ["web"] } });
        expect(changed.body.result).toBe("updated");
        expect(await prisma.auditLog.count()).toBe(audits + 1);
    });

    it.each(["50%off", "%41", "web 01", "a/b", "Ümlaut+x"])("handles the name %s exactly", async (name) => {
        const put = await call(ByName.PUT, { token: rw, method: "PUT", url: byName(name), body: {} });
        expect(put.status).toBe(201);
        expect(put.body.data.name).toBe(name);
        const get = await call(ByName.GET, { token: ro, url: byName(name) });
        expect(get.body.data.name).toBe(name);
    });

    it("rejects malformed URL encoding", async () => {
        const r = await call(ByName.GET, { token: ro, url: "/api/v1/configuration-items/by-name/%E0%A4%A" });
        expect(r.status).toBe(400);
    });

    it("returns 409 when the name is ambiguous", async () => {
        await call(Items.POST, { token: rw, body: { name: "dup" } });
        await call(Items.POST, { token: rw, body: { name: "dup" } });
        const r = await call(ByName.PUT, { token: rw, method: "PUT", url: byName("dup"), body: { ip: "10.0.0.3" } });
        expect(r.status).toBe(409);
        expect(r.body.error.code).toBe("conflict");
    });

    it("rejects a body name that differs from the URL", async () => {
        const r = await call(ByName.PUT, { token: rw, method: "PUT", url: byName("a"), body: { name: "b" } });
        expect(r.status).toBe(400);
    });
});

describe("upsert by external id", () => {
    const params = { source: "puppet", externalId: "web-01.example.com" };
    const url = byExt(params.source, params.externalId);

    it("requires a name to create, then upserts by identity", async () => {
        const missing = await call(ByExternal.PUT, { token: rw, method: "PUT", url, body: { ip: "10.0.0.1" } });
        expect(missing.status).toBe(400);

        const c = await call(ByExternal.PUT, { token: rw, method: "PUT", url, body: { name: "web-01", ip: "10.0.0.1" } });
        expect(c.status).toBe(201);
        expect(c.body.data).toMatchObject({ source: "puppet", externalId: "web-01.example.com" });

        expect((await call(ByExternal.GET, { token: ro, url })).body.data.id).toBe(c.body.data.id);
        const slash = await call(ByExternal.PUT, { token: rw, method: "PUT", url: byExt("vmware", "dc1/vm-42"), body: { name: "vm" } });
        expect(slash.body.data.externalId).toBe("dc1/vm-42");

        // Renaming keeps the identity
        const u = await call(ByExternal.PUT, { token: rw, method: "PUT", url, body: { name: "web-01-renamed" } });
        expect(u.status).toBe(200);
        expect(u.body.data).toMatchObject({ id: c.body.data.id, name: "web-01-renamed", ip: "10.0.0.1" });
    });

    it("enforces uniqueness of source + externalId on create", async () => {
        await call(Items.POST, { token: rw, body: { name: "a", ...params } });
        const r = await call(Items.POST, { token: rw, body: { name: "b", ...params } });
        expect(r.status).toBe(409);
    });
});

describe("bulk upsert", () => {
    it("creates and updates in one call", async () => {
        await call(ByName.PUT, { token: rw, method: "PUT", url: byName("existing"), body: {} });
        const r = await call(Bulk.POST, {
            token: rw,
            body: {
                items: [
                    { name: "existing", ip: "10.1.0.1" },
                    { name: "new-1", type: "Server", tags: ["bulk"] },
                    { match: "externalId", source: "vmware", externalId: "vm-42", name: "vm-42" },
                ],
            },
        });
        expect(r.status).toBe(200);
        expect(r.body.meta).toEqual({ created: 2, updated: 1, unchanged: 0 });
        expect(r.body.data.map((d: { result: string }) => d.result)).toEqual(["updated", "created", "created"]);
        expect(await prisma.configurationItem.count()).toBe(3);
        expect(await prisma.auditLog.count({ where: { description: { contains: "bulk upsert" } } })).toBe(3);
    });

    it("is atomic: one invalid item writes nothing", async () => {
        await prisma.customField.create({ data: { name: "cpu", label: "CPU", type: "NUMBER" } });
        const r = await call(Bulk.POST, {
            token: rw,
            body: { items: [{ name: "ok-1" }, { name: "bad", customFields: { cpu: "many" } }] },
        });
        expect(r.status).toBe(400);
        expect(r.body.error.details[0].path).toBe("items.1.customFields.cpu");
        expect(await prisma.configurationItem.count()).toBe(0);
    });

    it("rejects duplicate identities and oversized batches", async () => {
        const dup = await call(Bulk.POST, { token: rw, body: { items: [{ name: "x" }, { name: "x" }] } });
        expect(dup.status).toBe(400);
        expect(dup.body.error.details[0].path).toBe("items.1");

        const tooMany = await call(Bulk.POST, {
            token: rw,
            body: { items: Array.from({ length: 1001 }, (_, i) => ({ name: `n${i}` })) },
        });
        expect(tooMany.status).toBe(400);
    });

    it("handles a realistic batch of 500 items", async () => {
        const items = Array.from({ length: 500 }, (_, i) => ({
            name: `host-${i}`,
            ip: `10.2.${Math.floor(i / 250)}.${(i % 250) + 1}`,
            type: i % 2 ? "Server" : "VM",
            tags: ["sync"],
        }));
        const t0 = Date.now();
        const r = await call(Bulk.POST, { token: rw, body: { items } });
        expect(r.status).toBe(200);
        expect(r.body.meta.created).toBe(500);
        const again = await call(Bulk.POST, { token: rw, body: { items } });
        expect(again.body.meta).toEqual({ created: 0, updated: 0, unchanged: 500 });
        expect(Date.now() - t0).toBeLessThan(60_000);
    });
});

describe("types and tags", () => {
    it("creates and lists with item counts, rejecting duplicates", async () => {
        expect((await call(Types.POST, { token: rw, body: { name: "Switch" } })).status).toBe(201);
        expect((await call(Types.POST, { token: rw, body: { name: "switch" } })).status).toBe(409);
        await call(Items.POST, { token: rw, body: { name: "sw-1", type: "Switch", tags: ["core"] } });

        const types = await call(Types.GET, { token: ro });
        expect(types.body.data).toEqual([expect.objectContaining({ name: "Switch", itemCount: 1 })]);

        expect((await call(Tags.POST, { token: rw, body: { name: "edge", color: "#ff0000" } })).status).toBe(201);
        expect((await call(Tags.POST, { token: rw, body: { name: "x", color: "red" } })).status).toBe(400);
        const tags = await call(Tags.GET, { token: ro });
        expect(tags.body.data.map((t: { name: string; itemCount: number }) => [t.name, t.itemCount])).toEqual([
            ["core", 1],
            ["edge", 0],
        ]);
    });
});

describe("OpenAPI document", () => {
    it("describes every v1 operation", async () => {
        const res = Spec.GET();
        const doc = await res.json();
        expect(doc.openapi).toBe("3.1.0");
        expect(Object.keys(doc.paths)).toEqual(
            expect.arrayContaining([
                "/configuration-items",
                "/configuration-items/{id}",
                "/configuration-items/by-name/{name}",
                "/configuration-items/by-external-id/{source}/{externalId}",
                "/configuration-items/bulk-upsert",
                "/types",
                "/tags",
            ])
        );
        expect(doc.components.schemas.Item.properties.customFields).toBeDefined();
        expect(doc.components.securitySchemes.bearerAuth.scheme).toBe("bearer");
    });
});
