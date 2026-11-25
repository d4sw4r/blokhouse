// lib/api/v1/http.ts
// Shared request/response plumbing for /api/v1:
//   - one error format: { error: { code, message, details? } }
//   - authentication + scope check for every handler
//   - JSON body parsing and zod validation with readable details
import { z } from "zod";
import { authenticate, hasScope } from "@/lib/auth";

export type Scope = "read" | "write" | "audit" | "admin";

export type AuthContext = {
    via: "session" | "token";
    scopes: string[];
    tokenId?: string;
    user: { id: string; name?: string | null; email?: string | null; role: string };
};

export type ErrorCode =
    | "unauthorized"
    | "forbidden"
    | "not_found"
    | "validation_failed"
    | "invalid_json"
    | "conflict"
    | "payload_too_large"
    | "internal_error";

const STATUS: Record<ErrorCode, number> = {
    unauthorized: 401,
    forbidden: 403,
    not_found: 404,
    validation_failed: 400,
    invalid_json: 400,
    conflict: 409,
    payload_too_large: 413,
    internal_error: 500,
};

export class ApiError extends Error {
    constructor(
        public code: ErrorCode,
        message: string,
        public details?: unknown
    ) {
        super(message);
    }
}

export function json(data: unknown, status = 200, headers: Record<string, string> = {}): Response {
    return new Response(JSON.stringify(data), {
        status,
        headers: { "Content-Type": "application/json", ...headers },
    });
}

export function errorResponse(err: ApiError): Response {
    const body: { error: { code: string; message: string; details?: unknown } } = {
        error: { code: err.code, message: err.message },
    };
    if (err.details !== undefined) body.error.details = err.details;
    return json(body, STATUS[err.code]);
}

/** zod issues -> [{ path: "items.3.ip", message }] */
export function formatIssues(error: z.ZodError) {
    return error.issues.map((i) => ({
        path: i.path.join("."),
        message: i.message,
    }));
}

export function validate<T extends z.ZodTypeAny>(schema: T, value: unknown, what = "Request body"): z.infer<T> {
    const result = schema.safeParse(value);
    if (!result.success) {
        throw new ApiError("validation_failed", `${what} is invalid`, formatIssues(result.error));
    }
    return result.data;
}

export async function readJson(req: Request, maxBytes = 5 * 1024 * 1024): Promise<unknown> {
    const length = Number(req.headers.get("content-length") || 0);
    if (length > maxBytes) {
        throw new ApiError("payload_too_large", `Request body exceeds ${maxBytes} bytes`);
    }
    const text = await req.text();
    if (text.length > maxBytes) {
        throw new ApiError("payload_too_large", `Request body exceeds ${maxBytes} bytes`);
    }
    if (!text.trim()) throw new ApiError("invalid_json", "Request body must be a JSON document");
    try {
        return JSON.parse(text);
    } catch {
        throw new ApiError("invalid_json", "Request body is not valid JSON");
    }
}

type Handler<P> = (ctx: { req: Request; auth: AuthContext; params: P }) => Promise<Response>;

/**
 * Wrap a v1 route handler: authenticate, check the scope, map errors.
 *
 *   export const GET = route("read", async ({ req, auth, params }) => json(...));
 */
export function route<P = Record<string, string>>(scope: Scope, handler: Handler<P>) {
    return async (req: Request, context?: { params?: Promise<P> | P }): Promise<Response> => {
        try {
            const auth = (await authenticate(req)) as AuthContext | null;
            if (!auth) throw new ApiError("unauthorized", "Authentication required (session or Bearer token)");
            if (!hasScope(auth, scope)) {
                throw new ApiError("forbidden", `This operation requires the '${scope}' scope`);
            }
            // Next.js decodes dynamic params a second time on access, which throws for
            // values containing "%" (and silently turns "%41" into "A"). Routes whose
            // params can contain arbitrary text use pathSegments() instead.
            const params = ((await Promise.resolve(context?.params).catch(() => ({}))) ?? {}) as P;
            return await handler({ req, auth, params });
        } catch (err) {
            if (err instanceof ApiError) return errorResponse(err);
            if (err instanceof z.ZodError) {
                return errorResponse(new ApiError("validation_failed", "Request is invalid", formatIssues(err)));
            }
            // Prisma unique constraint violation
            if (typeof err === "object" && err && (err as { code?: string }).code === "P2002") {
                return errorResponse(new ApiError("conflict", "A record with these unique values already exists"));
            }
            console.error("[api/v1] unhandled error:", err);
            return errorResponse(new ApiError("internal_error", "Internal server error"));
        }
    };
}

/** Parse ?page=&per_page= with sane bounds. */
export function pagination(url: URL, defaults = { perPage: 50, maxPerPage: 500 }) {
    const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10) || 1);
    const perPage = Math.min(
        defaults.maxPerPage,
        Math.max(1, parseInt(url.searchParams.get("per_page") || String(defaults.perPage), 10) || defaults.perPage)
    );
    return { page, perPage, skip: (page - 1) * perPage, take: perPage };
}

export function pageMeta(page: number, perPage: number, total: number) {
    return { page, per_page: perPage, total, total_pages: Math.max(1, Math.ceil(total / perPage)) };
}

/**
 * The last `count` path segments of the request URL, URL-decoded exactly once.
 * Use for params that may contain any text (item names, external IDs).
 */
export function pathSegments(req: Request, count: number): string[] {
    const raw = new URL(req.url).pathname.split("/").filter(Boolean).slice(-count);
    if (raw.length !== count) throw new ApiError("not_found", "Not found");
    try {
        return raw.map((s) => decodeURIComponent(s));
    } catch {
        throw new ApiError("validation_failed", "Malformed URL encoding in path");
    }
}
