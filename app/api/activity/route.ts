import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

export async function GET(request: NextRequest) {
    const { response } = await requireAuth(request, "read");
    if (response) return response;

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "10", 10);

    try {
        const activities = await prisma.auditLog.findMany({
            orderBy: { createdAt: "desc" },
            take: limit,
            select: {
                id: true,
                action: true,
                entityType: true,
                entityId: true,
                description: true,
                createdAt: true,
                user: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                    },
                },
            },
        });

        return new Response(JSON.stringify(activities), {
            status: 200,
            headers: { "Content-Type": "application/json" },
        });
    } catch (error) {
        console.error("Activity API error:", error);
        return new Response(
            JSON.stringify({ error: "Failed to fetch activity" }),
            { status: 500, headers: { "Content-Type": "application/json" } }
        );
    }
}
