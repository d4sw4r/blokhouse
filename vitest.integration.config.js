// Integration tests: run against a real PostgreSQL database.
//   DATABASE_URL=postgresql://... npx prisma migrate deploy
//   DATABASE_URL=postgresql://... npm run test:integration
// The tests TRUNCATE all tables — never point this at a database you care about.
import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
    test: {
        environment: "node",
        include: ["__tests__/integration/**/*.test.{js,ts}"],
        setupFiles: ["__tests__/integration/setup.ts"],
        fileParallelism: false,
        testTimeout: 30_000,
        hookTimeout: 30_000,
    },
    resolve: {
        alias: { "@": path.resolve(__dirname, ".") },
    },
});
