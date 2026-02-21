// app/api/docs/route.js
// Returns OpenAPI/Swagger specification as JSON

import { getApiDocs } from "@/lib/swagger";

/**
 * @swagger
 * /api/docs:
 *   get:
 *     summary: Get OpenAPI specification
 *     description: Returns the OpenAPI 3.0 specification for the Blokhouse API
 *     tags: [Documentation]
 *     responses:
 *       200:
 *         description: OpenAPI specification JSON
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 */
export async function GET() {
    const spec = await getApiDocs();
    return new Response(JSON.stringify(spec, null, 2), {
        status: 200,
        headers: {
            "Content-Type": "application/json",
        },
    });
}
