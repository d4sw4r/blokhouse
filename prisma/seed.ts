// prisma/seed.ts — creates the initial administrator if none exists.
//
// Environment:
//   ADMIN_EMAIL     (default: admin@example.com)
//   ADMIN_PASSWORD  (default: randomly generated, see below)
//   ADMIN_PASSWORD_FILE (default: <database dir>/initial-admin-password)
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
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

const databaseUrl = process.env.DATABASE_URL || "file:./prisma/blokhouse.db";
const prisma = new PrismaClient({
    adapter: new PrismaBetterSqlite3({ url: databaseUrl }),
});

function passwordFilePath() {
    if (process.env.ADMIN_PASSWORD_FILE) return process.env.ADMIN_PASSWORD_FILE;
    const dbFile = databaseUrl.startsWith("file:") ? databaseUrl.slice("file:".length) : "./prisma/blokhouse.db";
    return path.join(path.dirname(path.resolve(dbFile)), "initial-admin-password");
}

async function main() {
    const existingAdmin = await prisma.user.findFirst({ where: { role: "ADMIN" }, select: { email: true } });
    if (existingAdmin) {
        console.log(`Admin user already exists (${existingAdmin.email}) — skipping seed.`);
        return;
    }

    const email = process.env.ADMIN_EMAIL || "admin@example.com";
    const generated = !process.env.ADMIN_PASSWORD;
    const password = process.env.ADMIN_PASSWORD || crypto.randomBytes(18).toString("base64url");

    if (password.length < 8) {
        throw new Error("ADMIN_PASSWORD must be at least 8 characters");
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

    await prisma.user.upsert({
        where: { email },
        update: { role: "ADMIN", password: bcrypt.hashSync(password, 12) },
        create: {
            name: "Admin",
            email,
            password: bcrypt.hashSync(password, 12),
            emailVerified: new Date(),
            role: "ADMIN",
        },
    });

    console.log("==============================================");
    console.log(" Blokhouse admin user created");
    console.log(`   Email:    ${email}`);
    console.log(`   Password: ${passwordInfo}`);
    console.log("==============================================");
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
