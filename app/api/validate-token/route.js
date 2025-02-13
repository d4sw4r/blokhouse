// app/api/validate-token/route.js
export const runtime = "nodejs"; // Force Node.js runtime for Prisma support

import prisma from "@/lib/prisma";

export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get("token");
    if (!token) {
        return new Response(JSON.stringify({ valid: false }), { status: 400 });
    }
    try {
        const tokenRecord = await prisma.apiToken.findUnique({
            where: { token },
        });
        return new Response(JSON.stringify({ valid: Boolean(tokenRecord) }), { status: 200 });
    } catch (error) {
        console.error("Error validating token:", error);
        return new Response(JSON.stringify({ valid: false, error: error.message }), { status: 500 });
    }
}
