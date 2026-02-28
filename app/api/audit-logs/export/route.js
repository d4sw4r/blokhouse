// app/api/audit-logs/export/route.js
// Audit log export endpoint (CSV/JSON) - Admin/Audit role only

import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import authOptions from "@/lib/authOptions";

// Helper to check if user can view audit logs (ADMIN or AUDIT role)
function canViewAuditLogs(role) {
    return role === "ADMIN" || role === "AUDIT";
}

function escapeCSV(value) {
    if (value === null || value === undefined) return "";
    const str = String(value);
    if (str.includes(",") || str.includes('"') || str.includes("\n")) {
        return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
}

/**
 * @swagger
 * /api/audit-logs/export:
 *   get:
 *     summary: Export audit logs
 *     description: Export audit logs as CSV or JSON (Admin/Audit role only)
 *     tags: [Audit Logs]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: query
 *         name: format
 *         schema:
 *           type: string
 *           enum: [csv, json]
 *           default: json
 *         description: Export format
 *       - in: query
 *         name: action
 *         schema:
 *           type: string
 *           enum: [CREATE, UPDATE, DELETE, LOGIN, LOGOUT, API_TOKEN_CREATED, API_TOKEN_DELETED]
 *         description: Filter by action type
 *       - in: query
 *         name: entityType
 *         schema:
 *           type: string
 *         description: Filter by entity type
 *       - in: query
 *         name: userId
 *         schema:
 *           type: string
 *         description: Filter by user who performed the action
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter by start date (ISO 8601)
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter by end date (ISO 8601)
 *     responses:
 *       200:
 *         description: Exported audit logs
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/AuditLog'
 *           text/csv:
 *             schema:
 *               type: string
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (requires Admin or Audit role)
 */
export async function GET(request) {
    const session = await getServerSession(authOptions);
    if (!session) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { 
            status: 401,
            headers: { "Content-Type": "application/json" }
        });
    }

    if (!canViewAuditLogs(session.user.role)) {
        return new Response(
            JSON.stringify({ error: "Forbidden: Admin or Audit role required" }),
            { status: 403, headers: { "Content-Type": "application/json" } }
        );
    }

    try {
        const { searchParams } = new URL(request.url);

        // Parse query parameters
        const format = searchParams.get("format") || "json";
        const action = searchParams.get("action");
        const entityType = searchParams.get("entityType");
        const entityId = searchParams.get("entityId");
        const userId = searchParams.get("userId");
        const startDate = searchParams.get("startDate");
        const endDate = searchParams.get("endDate");

        // Build where clause
        const where = {};
        if (action) where.action = action;
        if (entityType) where.entityType = entityType;
        if (entityId) where.entityId = entityId;
        if (userId) where.userId = userId;
        
        // Date range filter
        if (startDate || endDate) {
            where.createdAt = {};
            if (startDate) where.createdAt.gte = new Date(startDate);
            if (endDate) where.createdAt.lte = new Date(endDate);
        }

        // Fetch all matching logs with user info
        const logs = await prisma.auditLog.findMany({
            where,
            include: {
                user: {
                    select: { id: true, name: true, email: true },
                },
            },
            orderBy: { createdAt: "desc" },
        });

        const timestamp = new Date().toISOString().split("T")[0];

        if (format === "csv") {
            // CSV Export
            const headers = [
                "ID",
                "Action",
                "Entity Type",
                "Entity ID",
                "User Name",
                "User Email",
                "Description",
                "Old Values",
                "New Values",
                "IP Address",
                "User Agent",
                "Created At",
            ];

            const rows = logs.map((log) => [
                log.id,
                log.action,
                log.entityType,
                log.entityId || "",
                log.user?.name || "System",
                log.user?.email || "",
                log.description || "",
                log.oldValues || "",
                log.newValues || "",
                log.ipAddress || "",
                log.userAgent || "",
                log.createdAt.toISOString(),
            ]);

            const csvContent = [
                headers.join(","),
                ...rows.map((row) => row.map(escapeCSV).join(",")),
            ].join("\n");

            return new Response(csvContent, {
                status: 200,
                headers: {
                    "Content-Type": "text/csv; charset=utf-8",
                    "Content-Disposition": `attachment; filename="audit-logs-${timestamp}.csv"`,
                },
            });
        } else {
            // JSON Export
            const exportData = logs.map((log) => ({
                id: log.id,
                action: log.action,
                entityType: log.entityType,
                entityId: log.entityId,
                user: log.user
                    ? { name: log.user.name, email: log.user.email }
                    : null,
                description: log.description,
                oldValues: log.oldValues,
                newValues: log.newValues,
                ipAddress: log.ipAddress,
                userAgent: log.userAgent,
                createdAt: log.createdAt.toISOString(),
            }));

            return new Response(JSON.stringify(exportData, null, 2), {
                status: 200,
                headers: {
                    "Content-Type": "application/json",
                    "Content-Disposition": `attachment; filename="audit-logs-${timestamp}.json"`,
                },
            });
        }
    } catch (error) {
        console.error("Error exporting audit logs:", error);
        return new Response(
            JSON.stringify({ error: "Failed to export audit logs" }),
            { status: 500, headers: { "Content-Type": "application/json" } }
        );
    }
}
