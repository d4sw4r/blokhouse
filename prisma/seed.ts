// prisma/seed.ts — creates the initial administrator if none exists.
//
// Environment:
//   ADMIN_EMAIL     (default: admin@example.com)
//   ADMIN_PASSWORD  (default: randomly generated, see below)
//   ADMIN_PASSWORD_FILE (default: ./data/initial-admin-password)
//
// A generated password is never logged (logs are often shipped to central
// systems). It is written to ADMIN_PASSWORD_FILE with mode 0600 instead.
//
// Idempotent: if any ADMIN user exists, nothing is changed.
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import bcrypt from "bcryptjs";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set");
}
const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

function passwordFilePath() {
    return path.resolve(process.env.ADMIN_PASSWORD_FILE || "./data/initial-admin-password");
}

// Arbitrary constant key for pg_advisory_xact_lock: serialises concurrent
// seed runs (e.g. several app replicas starting at once). Do not reuse it.
const SEED_LOCK_KEY = 724300001;

async function main() {
    const email = process.env.ADMIN_EMAIL || "admin@example.com";
    const generated = !process.env.ADMIN_PASSWORD;
    const password = process.env.ADMIN_PASSWORD || crypto.randomBytes(18).toString("base64url");

    if (password.length < 8) {
        throw new Error("ADMIN_PASSWORD must be at least 8 characters");
    }

    // Hash before the transaction: bcrypt is slow and must not hold the lock.
    const passwordHash = bcrypt.hashSync(password, 12);

    await prisma.$transaction(
        async (tx) => {
            await tx.$executeRaw`SELECT pg_advisory_xact_lock(${SEED_LOCK_KEY})`;

            const existingAdmin = await tx.user.findFirst({ where: { role: "ADMIN" }, select: { email: true } });
            if (existingAdmin) {
                console.log(`Admin user already exists (${existingAdmin.email}) — skipping seed.`);
                return;
            }

            // Write the password file before creating the user, so a failure cannot
            // leave an admin account whose password nobody knows.
            let passwordInfo = "(from ADMIN_PASSWORD)";
            if (generated) {
                const file = passwordFilePath();
                fs.mkdirSync(path.dirname(file), { recursive: true });
                fs.writeFileSync(file, password + "\n", { mode: 0o600 });
                passwordInfo = `written to ${file} (delete it after first login)`;
            }

            await tx.user.upsert({
                where: { email },
                update: { role: "ADMIN", password: passwordHash },
                create: {
                    name: "Admin",
                    email,
                    password: passwordHash,
                    emailVerified: new Date(),
                    role: "ADMIN",
                },
            });

            console.log("==============================================");
            console.log(" Blokhouse admin user created");
            console.log(`   Email:    ${email}`);
            console.log(`   Password: ${passwordInfo}`);
            console.log("==============================================");
        },
        { timeout: 30_000 }
    );
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
