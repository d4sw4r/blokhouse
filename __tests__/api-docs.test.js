import { describe, it, expect } from "vitest";
import { getApiDocs } from "../lib/swagger.js";

// The legacy spec generator scans app/api and reads every *.json path it finds.
// A route folder with a ".json" name (e.g. "openapi.json") makes it crash with EISDIR.
describe("legacy OpenAPI spec (/api/docs)", () => {
    it("generates without errors and documents endpoints", async () => {
        const spec = await getApiDocs();
        expect(Object.keys(spec.paths).length).toBeGreaterThan(5);
    });
});
