// GET /api/v1 — public entry point listing the available resources.
import pkg from "@/package.json";

export function GET() {
    return new Response(
        JSON.stringify({
            name: "Blokhouse API",
            version: "v1",
            release: pkg.version,
            openapi: "/api/v1/openapi.json",
            resources: {
                configurationItems: "/api/v1/configuration-items",
                types: "/api/v1/types",
                tags: "/api/v1/tags",
                webhooks: "/api/v1/webhooks",
            },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
    );
}
