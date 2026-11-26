// Chart render tests: run `helm template` against charts/blokhouse.
// Needs helm on PATH or HELM_BIN pointing at it.
import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        environment: "node",
        include: ["__tests__/helm/**/*.test.{js,ts}"],
        testTimeout: 30_000,
    },
});
