// GET /api/v1/openapi.json — public OpenAPI 3.1 document for API v1.
// Served from /api/v1/openapi via a rewrite in next.config.ts: a route folder
// named "openapi.json" breaks the legacy spec generator (it reads *.json files).
import { openApiDocument } from "@/lib/api/v1/openapi";
import pkg from "@/package.json";

export function GET() {
    return new Response(JSON.stringify(openApiDocument(pkg.version), null, 2), {
        status: 200,
        headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=300" },
    });
}
