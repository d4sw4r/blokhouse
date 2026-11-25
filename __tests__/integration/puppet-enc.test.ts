import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { resetDb, tokenFor, call, prisma } from "./helpers";
import * as Puppet from "@/app/api/puppet/route";
import * as Items from "@/app/api/v1/configuration-items/route";

let token: string;
beforeEach(async () => {
    await resetDb();
    token = (await tokenFor("API", ["read", "write"])).token;
    for (const name of ["puppet_classes", "puppet_environment", "rack"]) {
        await prisma.customField.create({ data: { name, label: name, type: "STRING" } });
    }
});
afterAll(() => prisma.$disconnect());

async function enc(node: string) {
    const res = await Puppet.GET(
        new Request(`http://localhost/api/puppet?node=${encodeURIComponent(node)}`, {
            headers: { authorization: `Bearer ${token}` },
        })
    );
    const text = await res.text();
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/yaml");
    expect(text.startsWith("---\n")).toBe(true);
    return JSON.parse(text.slice(4));
}

const create = (body: object) => call(Items.POST, { token, url: "/api/v1/configuration-items", body });

describe("Puppet ENC", () => {
    it("classifies from the puppet_* custom fields and passes $blokhouse", async () => {
        await create({
            name: "web-01.example.com",
            type: "Server",
            tags: ["prod"],
            customFields: { puppet_classes: "role::web profile::base", puppet_environment: "production", rack: "14" },
        });
        const e = await enc("web-01.example.com");
        expect(e.classes).toEqual({ "role::web": {}, "profile::base": {} });
        expect(e.environment).toBe("production");
        expect(e.parameters.blokhouse).toMatchObject({ type: "Server", tags: ["prod"], custom_fields: { rack: "14" } });
    });

    it("never derives an environment or class from the type", async () => {
        await create({ name: "db-01", type: "Database Server" });
        const e = await enc("db-01");
        expect(e.classes).toEqual({});
        expect(e).not.toHaveProperty("environment");
    });

    it("prefers the Puppet certname (external ID), then the name (case-insensitive), then the IP", async () => {
        await create({ name: "web-01.example.com", description: "by name" });
        await create({ name: "web-01", source: "puppet", externalId: "web-01.example.com", description: "by certname" });
        await create({ name: "legacy", ip: "10.0.0.9", description: "by ip" });

        expect((await enc("web-01.example.com")).parameters.description).toBe("by certname");
        expect((await enc("WEB-01")).parameters.description).toBe("by certname");
        expect((await enc("10.0.0.9")).parameters.description).toBe("by ip");
    });

    it("returns an empty classification for unknown nodes", async () => {
        expect(await enc("nope.example.com")).toEqual({ classes: {}, parameters: { blokhouse_managed: false } });
    });

    it("requires a token", async () => {
        const res = await Puppet.GET(new Request("http://localhost/api/puppet?node=x"));
        expect(res.status).toBe(401);
    });
});
