// prisma/seed.ts — creates the initial administrator if none exists.
//
// Environment:
//   ADMIN_EMAIL     (default: admin@example.com)
//   ADMIN_PASSWORD  (default: randomly generated and printed once)
//
// Idempotent: if any ADMIN user exists, nothing is changed.
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

const prisma = new PrismaClient({
    adapter: new PrismaBetterSqlite3({ url: process.env.DATABASE_URL || "file:./prisma/blokhouse.db" }),
});

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
    if (generated) {
        console.log(`   Password: ${password}`);
        console.log(" Store this password now — it is not shown again.");
    } else {
        console.log("   Password: (from ADMIN_PASSWORD)");
    }
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
