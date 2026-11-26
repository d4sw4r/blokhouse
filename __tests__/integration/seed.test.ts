// The seed runs at start in every app replica, so it must be safe to run concurrently.
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import prisma from "@/lib/prisma";
import { resetDb } from "./helpers";

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "bh-seed-"));

function runSeed(password: string, email = "seed@test.io"): Promise<{ code: number | null; output: string }> {
    return new Promise((resolve) => {
        const child = spawn("npx", ["tsx", "prisma/seed.ts"], {
            env: {
                ...process.env,
                DATABASE_URL: process.env.DATABASE_URL,
                ADMIN_EMAIL: email,
                ADMIN_PASSWORD: password,
                ADMIN_PASSWORD_FILE: path.join(tmpDir, "initial-admin-password"),
            },
        });
        let output = "";
        child.stdout.on("data", (d) => (output += d));
        child.stderr.on("data", (d) => (output += d));
        child.on("close", (code) => resolve({ code, output }));
    });
}

describe("prisma/seed.ts", () => {
    beforeEach(resetDb);

    it("concurrent seeds create one admin", async () => {
        for (let round = 0; round < 5; round++) {
            await resetDb();
            const results = await Promise.all([runSeed("seed-password-1"), runSeed("seed-password-1")]);
            for (const r of results) expect(r.code, r.output).toBe(0);
            expect(await prisma.user.count({ where: { role: "ADMIN" } })).toBe(1);
        }
    }, 60_000);

    it("concurrent seeds with different emails still create one admin", async () => {
        for (let round = 0; round < 5; round++) {
            await resetDb();
            const results = await Promise.all([
                runSeed("seed-password-1", "a@test.io"),
                runSeed("seed-password-1", "b@test.io"),
            ]);
            for (const r of results) expect(r.code, r.output).toBe(0);
            expect(await prisma.user.count({ where: { role: "ADMIN" } })).toBe(1);
        }
    }, 60_000);

    it("seed is a no-op when an admin exists", async () => {
        const admin = await prisma.user.create({
            data: { email: "existing@test.io", password: "existing-hash", role: "ADMIN" },
        });
        const r = await runSeed("other-password");
        expect(r.code, r.output).toBe(0);
        const after = await prisma.user.findUniqueOrThrow({ where: { id: admin.id } });
        expect(after.password).toBe("existing-hash");
        expect(await prisma.user.count()).toBe(1);
    }, 60_000);
});
