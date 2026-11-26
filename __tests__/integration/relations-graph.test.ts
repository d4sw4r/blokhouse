import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { resetDb, tokenFor, call, prisma } from "./helpers";
import * as Relations from "@/app/api/relations/route";

let token: string;
beforeEach(async () => {
    await resetDb();
    token = (await tokenFor("API", ["read"])).token;
});
afterAll(() => prisma.$disconnect());

async function item(name: string, status = "ACTIVE") {
    return prisma.configurationItem.create({ data: { name, status } });
}

describe("GET /api/relations (relationship graph)", () => {
    it("returns every relation with both ends, including non-active items", async () => {
        const web = await item("web-01");
        const db = await item("db-01", "DEPRECATED");
        const host = await item("host-01", "MAINTENANCE");
        await prisma.assetRelation.create({ data: { sourceId: web.id, targetId: db.id, type: "DEPENDS_ON", description: "orders" } });
        await prisma.assetRelation.create({ data: { sourceId: web.id, targetId: host.id, type: "RUNS_ON" } });

        const res = await call(Relations.GET, { token, url: "/api/relations" });

        expect(res.status).toBe(200);
        expect(res.body).toHaveLength(2);
        const dep = res.body.find((r: { type: string }) => r.type === "DEPENDS_ON");
        expect(dep).toMatchObject({
            sourceId: web.id,
            targetId: db.id,
            description: "orders",
            source: { id: web.id, name: "web-01", status: "ACTIVE" },
            target: { id: db.id, name: "db-01", status: "DEPRECATED" },
        });
    });

    it("returns more than 50 relations", async () => {
        const hub = await item("hub");
        for (let i = 0; i < 60; i++) {
            const leaf = await item(`leaf-${i}`);
            await prisma.assetRelation.create({ data: { sourceId: leaf.id, targetId: hub.id, type: "CONNECTED_TO" } });
        }
        const res = await call(Relations.GET, { token, url: "/api/relations" });
        expect(res.body).toHaveLength(60);
    });

    it("requires authentication", async () => {
        const res = await call(Relations.GET, { url: "/api/relations" });
        expect(res.status).toBe(401);
    });
});
