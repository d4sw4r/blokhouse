const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
    const email = 'admin@example.com';
    // Use ADMIN_PASSWORD env var (set by install.sh) or fall back to a random password
    const password = process.env.ADMIN_PASSWORD || require('crypto').randomBytes(12).toString('base64').replace(/[^a-zA-Z0-9]/g, '').slice(0, 16);
    const salt = bcrypt.genSaltSync(10);
    const hashedPassword = bcrypt.hashSync(password, salt);

    const adminUser = await prisma.user.upsert({
        where: { email },
        update: {}, // If the admin user already exists, do nothing (or update as needed)
        create: {
            name: 'Admin',
            email,
            password: hashedPassword,
            emailVerified: new Date(),
            role: 'ADMIN',
        },
    });

    console.log('Admin user seeded:', adminUser);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
