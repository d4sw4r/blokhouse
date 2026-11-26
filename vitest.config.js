import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
    test: {
        environment: "node",
        globals: false,
        include: ["__tests__/**/*.test.{js,ts}"],
        exclude: ["__tests__/integration/**", "__tests__/helm/**", "node_modules/**"],
    },
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "."),
        },
    },
});
