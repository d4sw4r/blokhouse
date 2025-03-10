// middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

async function validateApiToken(req: NextRequest): Promise<boolean> {
    const authHeader = req.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return false;
    }
    const apiToken = authHeader.slice("Bearer ".length).trim();
    const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
    // Build the URL to your validation endpoint.
    const url = `${baseUrl}/api/validate-token?token=${encodeURIComponent(apiToken)}`;

    try {
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) return false;
        const json = await res.json();
        return json.valid === true;
    } catch (error) {
        console.error("Error validating API token:", error);
        return false;
    }
}

export async function middleware(req: NextRequest) {
    // Add /api/validate-token to publicPaths so it is not intercepted.
    const publicPaths = ["/signin", "/signup", "/api/auth", "/api/validate-token", "/logo.svg", "/"];
    const { pathname } = req.nextUrl;

    if (publicPaths.some((path) => pathname.startsWith(path))) {
        return NextResponse.next();
    }

    if (pathname.startsWith("/api")) {
        const authHeader = req.headers.get("authorization");
        if (authHeader && authHeader.startsWith("Bearer ")) {
            const validApiToken = await validateApiToken(req);
            if (validApiToken) {
                return NextResponse.next();
            }
        }
    }

    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    if (!token) {
        const url = req.nextUrl.clone();
        url.pathname = "/signin";
        return NextResponse.redirect(url);
    }
    return NextResponse.next();
}

export const config = {
    matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
