// app/api/activity/route.js
// Recent activity endpoint - returns latest audit log entries (public within session)

import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import authOptions from "@/lib/authOptions";

/**
 * @swagger
 * /api/activity:
 *   get:
 *     summary: Get recent activity
 *     description: Returns the most recent audit log entries for dashboard display
 *     tags: [Activity]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Number of recent activities to return
 *     responses:
 *       200:
 *         description: Recent activity entries
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: string
 *                   action:
 *                     type: string
 *                   entityType:
 *                     type: string
 *                   entityId:
 *                     type: string
 *                   description:
 *                     type: string
 *                   user:
 *                     type: object
 *                   createdAt:
 *                     type: string
 *       401:
 *         description: Unauthorized
 */
export async function GET(request) {
    const session = await getServerSession(authOptions);
    if (!session) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }

    try {
        const { searchParams } = new URL(request.url);
        const limit = parseInt(searchParams.get("limit") || "10", 10);

        // Fetch recent audit logs with user info
        const activities = await prisma.auditLog.findMany({
            include: {
                user: {
                    select: { id: true, name: true, email: true },
                },
            },
            orderBy: { createdAt: "desc" },
            take: limit,
        });

        return new Response(JSON.stringify(activities, null, 2), {
            status: 200,
            headers: { "Content-Type": "application/json" },
        });
    } catch (error) {
        console.error("Error fetching recent activity:", error);
        return new Response(
            JSON.stringify({ error: "Failed to fetch recent activity" }),
            { status: 500 }
        );
    }
}
