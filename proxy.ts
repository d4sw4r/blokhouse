// proxy.ts  (Next.js 16 — renamed from middleware.ts)
//
// Defense in depth only. Every API route authenticates and authorizes itself
// via lib/auth.js; this proxy just
//   * rejects /api requests that carry neither a Bearer token nor a session,
//   * redirects unauthenticated page requests to /signin,
//   * keeps non-admins out of the admin UI.
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

// Exact public paths and public prefixes. Never add "/" as a prefix.
const PUBLIC_EXACT = new Set(["/", "/signin", "/signup", "/logo.svg", "/logo.png", "/favicon.ico"]);
// Matched as the exact path or a sub-path ("/api/health" does NOT match "/api/healthz").
const PUBLIC_PREFIXES = ["/api/auth", "/api/health", "/api/docs"];

// Admin UI pages that non-admin roles may still open.
const ADMIN_EXCEPTIONS: Record<string, string[]> = {
    "/admin/api": ["ADMIN", "USER", "AUDIT", "READONLY"], // own API tokens
    "/admin/audit-logs": ["ADMIN", "AUDIT"],
};

export function isPublicPath(pathname: string): boolean {
    if (PUBLIC_EXACT.has(pathname)) return true;
    return PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

function hasBearer(req: NextRequest): boolean {
    const h = req.headers.get("authorization");
    return !!h && h.startsWith("Bearer ") && h.length > "Bearer ".length;
}

export async function proxy(req: NextRequest) {
    const { pathname } = req.nextUrl;

    if (isPublicPath(pathname)) {
        return NextResponse.next();
    }

    // API: token requests are validated by the route handler itself.
    if (pathname.startsWith("/api/") && hasBearer(req)) {
        return NextResponse.next();
    }

    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });

    if (pathname.startsWith("/api/")) {
        if (!token) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        return NextResponse.next();
    }

    if (!token) {
        const url = req.nextUrl.clone();
        url.pathname = "/signin";
        url.search = "";
        return NextResponse.redirect(url);
    }

    if (pathname === "/admin" || pathname.startsWith("/admin/")) {
        const role = typeof token.role === "string" ? token.role : "";
        const exception = Object.keys(ADMIN_EXCEPTIONS).find(
            (p) => pathname === p || pathname.startsWith(p + "/")
        );
        const allowed = exception ? ADMIN_EXCEPTIONS[exception] : ["ADMIN"];
        if (!allowed.includes(role)) {
            const url = req.nextUrl.clone();
            url.pathname = "/dashboard";
            url.search = "";
            return NextResponse.redirect(url);
        }
    }

    return NextResponse.next();
}

export const config = {
    matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
