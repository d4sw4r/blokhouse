const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
    const email = 'admin@example.com';
    const password = 'admin'; // Change this to a secure default password
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
