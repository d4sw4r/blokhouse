// app/api/audit-logs/route.js
// Audit log viewing endpoint (read-only, admin/audit role only)

import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import authOptions from "@/lib/authOptions";

// Helper to check if user can view audit logs (ADMIN or AUDIT role)
function canViewAuditLogs(role) {
    return role === "ADMIN" || role === "AUDIT";
}

export async function GET(request) {
    const session = await getServerSession(authOptions);
    if (!session) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }

    if (!canViewAuditLogs(session.user.role)) {
        return new Response(
            JSON.stringify({ error: "Forbidden: Admin or Audit role required" }),
            { status: 403 }
        );
    }

    try {
        const { searchParams } = new URL(request.url);

        // Parse query parameters
        const action = searchParams.get("action");
        const entityType = searchParams.get("entityType");
        const entityId = searchParams.get("entityId");
        const userId = searchParams.get("userId");
        const page = parseInt(searchParams.get("page") || "1", 10);
        const limit = parseInt(searchParams.get("limit") || "50", 10);

        // Build where clause
        const where = {};
        if (action) where.action = action;
        if (entityType) where.entityType = entityType;
        if (entityId) where.entityId = entityId;
        if (userId) where.userId = userId;

        // Calculate pagination
        const skip = (page - 1) * limit;

        // Get total count
        const total = await prisma.auditLog.count({ where });

        // Fetch logs with user info
        const logs = await prisma.auditLog.findMany({
            where,
            include: {
                user: {
                    select: { id: true, name: true, email: true },
                },
            },
            orderBy: { createdAt: "desc" },
            skip,
            take: limit,
        });

        return new Response(
            JSON.stringify({
                logs,
                pagination: {
                    total,
                    page,
                    limit,
                    totalPages: Math.ceil(total / limit),
                },
            }, null, 2),
            { status: 200, headers: { "Content-Type": "application/json" } }
        );
    } catch (error) {
        console.error("Error fetching audit logs:", error);
        return new Response(
            JSON.stringify({ error: "Failed to fetch audit logs" }),
            { status: 500 }
        );
    }
}
