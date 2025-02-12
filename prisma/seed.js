const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const email = 'admin@example.com';

    // Upsert the user: update nothing if exists, or create if not
    const user = await prisma.user.upsert({
        where: { email },
        update: {}, // If user exists, do nothing (or add fields to update)
        create: {
            name: 'Admin',
            email,
            // WARNING: This example stores a plain text password. In production, hash passwords!
            password: 'admin',
            emailVerified: new Date(),
        },
    });

    console.log('User seeded:', user);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });