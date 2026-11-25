import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { resetDb, tokenFor, call, prisma } from "./helpers";
import * as CustomFields from "@/app/api/custom-fields/route";

let rw: string;
beforeEach(async () => {
    await resetDb();
    rw = (await tokenFor("API", ["read", "write"])).token;
});
afterAll(() => prisma.$disconnect());

describe("legacy POST /api/custom-fields", () => {
    it("stores options as JSON text", async () => {
        const r = await call(CustomFields.POST, {
            token: rw,
            url: "/api/custom-fields",
            body: { name: "env", label: "Environment", type: "STRING", options: ["prod", "staging"] },
        });
        expect(r.status).toBe(201);
        expect(r.body.options).toEqual(["prod", "staging"]);
        const stored = await prisma.customField.findFirst({ where: { name: "env" } });
        expect(JSON.parse(stored!.options)).toEqual(["prod", "staging"]);

        const list = await call(CustomFields.GET, { token: rw, url: "/api/custom-fields" });
        expect(list.body[0].options).toEqual(["prod", "staging"]);
    });

    it("rejects non-array options with 400", async () => {
        const r = await call(CustomFields.POST, {
            token: rw,
            url: "/api/custom-fields",
            body: { name: "bad", label: "Bad", type: "STRING", options: "prod,staging" },
        });
        expect(r.status).toBe(400);
    });

    it("works without options", async () => {
        const r = await call(CustomFields.POST, {
            token: rw,
            url: "/api/custom-fields",
            body: { name: "os", label: "OS", type: "STRING" },
        });
        expect(r.status).toBe(201);
    });
});
