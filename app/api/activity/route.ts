import { NextRequest } from "next/server";
import { getServerSession } from "next-auth/next";
import authOptions from "@/lib/authOptions";
import prisma from "@/lib/prisma";

export async function GET(request: NextRequest) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const session = await getServerSession(authOptions as any) as any;
    if (!session?.user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
        });
    }

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
