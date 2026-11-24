import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const globalForPrisma = globalThis;

function createClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set (expected postgresql://user:password@host:5432/blokhouse)');
  }
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}

// Created lazily so that importing this module (e.g. during `next build`)
// does not require a database connection string.
/** @type {PrismaClient} */
const prisma = /** @type {any} */ (new Proxy({}, {
  get(_target, prop) {
    if (!globalForPrisma.prisma) globalForPrisma.prisma = createClient();
    const value = globalForPrisma.prisma[prop];
    return typeof value === 'function' ? value.bind(globalForPrisma.prisma) : value;
  },
}));

export default prisma;
