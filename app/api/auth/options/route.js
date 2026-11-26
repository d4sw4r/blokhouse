// app/api/auth/options/route.js — public: which sign-in methods the login/token UIs should offer.
import { getOidcConfig, passwordLoginEnabled } from "@/lib/oidc";

export async function GET() {
    const config = getOidcConfig();
    return new Response(
        JSON.stringify({
            passwordLogin: passwordLoginEnabled(),
            sso: config ? { name: config.name } : null,
            ssoTokenMaxDays: config ? config.tokenMaxDays : null,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
    );
}
