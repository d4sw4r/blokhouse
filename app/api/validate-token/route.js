// app/api/validate-token/route.js
// Lets integrations verify their configured token:
//   curl -H "Authorization: Bearer bh_..." https://cmdb.example.com/api/validate-token
// Tokens are only accepted in the Authorization header (never in the URL,
// where they end up in access logs).
export const runtime = "nodejs";

import { authenticate } from "@/lib/auth";

export async function GET(request) {
    const header = request.headers.get("authorization");
    if (!header || !header.startsWith("Bearer ")) {
        return new Response(JSON.stringify({ valid: false, error: "Missing Bearer token" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
        });
    }
    const auth = await authenticate(request);
    if (!auth) {
        return new Response(JSON.stringify({ valid: false }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
        });
    }
    return new Response(
        JSON.stringify({ valid: true, scopes: auth.scopes, user: { email: auth.user.email, role: auth.user.role } }),
        { status: 200, headers: { "Content-Type": "application/json" } }
    );
}
