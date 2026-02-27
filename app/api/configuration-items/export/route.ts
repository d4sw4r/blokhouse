import { NextRequest } from "next/server";
import { getServerSession } from "next-auth/next";
import authOptions from "@/lib/authOptions";
import prisma from "@/lib/prisma";

async function getUserFromRequest(request: NextRequest) {
    const authHeader = request.headers.get("authorization");
    if (authHeader && authHeader.startsWith("Bearer ")) {
        const apiToken = authHeader.slice("Bearer ".length).trim();
        try {
            const tokenRecord = await prisma.apiToken.findUnique({
                where: { token: apiToken },
                include: { user: true },
            });
            if (tokenRecord?.user) {
                return { user: tokenRecord.user, authorized: true };
            }
        } catch (error) {
            console.error("Error checking API token:", error);
        }
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const session = await getServerSession(authOptions as any) as any;
    if (session?.user) {
        return { user: session.user, authorized: true };
    }
    return { authorized: false };
}

function escapeCSV(value: string | null | undefined): string {
    if (value === null || value === undefined) return "";
    const str = String(value);
    if (str.includes(",") || str.includes('"') || str.includes("\n")) {
        return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
}

/**
 * @swagger
 * /api/configuration-items/export:
 *   get:
 *     summary: Export configuration items
 *     description: Export all configuration items as CSV or JSON with optional filtering
 *     tags: [Configuration Items]
 *     security:
 *       - bearerAuth: []
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
 *         name: typeId
 *         schema:
 *           type: string
 *         description: Filter by item type ID
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [ACTIVE, DEPRECATED, MAINTENANCE]
 *         description: Filter by asset status
 *       - in: query
 *         name: includeTags
 *         schema:
 *           type: boolean
 *           default: true
 *         description: Include tags in export
 *     responses:
 *       200:
 *         description: Exported data
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/ConfigurationItem'
 *           text/csv:
 *             schema:
 *               type: string
 *       401:
 *         description: Unauthorized
 */
export async function GET(request: NextRequest) {
    const { authorized } = await getUserFromRequest(request);
    if (!authorized) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { 
            status: 401,
            headers: { "Content-Type": "application/json" }
        });
    }

    const { searchParams } = new URL(request.url);
    const format = searchParams.get("format") || "json";
    const typeId = searchParams.get("typeId") || "";
    const status = searchParams.get("status") || "";
    const includeTags = searchParams.get("includeTags") !== "false";

    // Build where clause for filtering
    const where: Record<string, unknown> = {};
    if (typeId) {
        where.itemTypeId = typeId;
    }
    if (status) {
        where.status = status;
    }

    // Fetch all items with relations
    const items = await prisma.configurationItem.findMany({
        where,
        include: {
            itemType: true,
            tags: includeTags,
            customFieldValues: {
                include: { customField: true },
            },
        },
        orderBy: { createdAt: "desc" },
    });

    const timestamp = new Date().toISOString().split("T")[0];

    if (format === "csv") {
        // CSV Export
        const headers = [
            "ID",
            "Name",
            "Description",
            "IP",
            "MAC",
            "Type",
            "Status",
            "Tags",
            "Created At",
            "Updated At",
        ];

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const rows = items.map((item: any) => [
            item.id,
            item.name,
            item.description || "",
            item.ip || "",
            item.mac || "",
            item.itemType?.name || "",
            item.status,
            item.tags?.map((t: any) => t.name).join("; ") || "",
            item.createdAt.toISOString(),
            item.updatedAt.toISOString(),
        ]);

        const csvContent = [
            headers.join(","),
            ...rows.map((row: any) => row.map(escapeCSV).join(",")),
        ].join("\n");

        return new Response(csvContent, {
            status: 200,
            headers: {
                "Content-Type": "text/csv; charset=utf-8",
                "Content-Disposition": `attachment; filename="blokhouse-export-${timestamp}.csv"`,
            },
        });
    } else {
        // JSON Export
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const exportData = items.map((item: any) => ({
            id: item.id,
            name: item.name,
            description: item.description,
            ip: item.ip,
            mac: item.mac,
            status: item.status,
            type: item.itemType?.name || null,
            tags: item.tags?.map((t: any) => ({ name: t.name, color: t.color })) || [],
            customFields: item.customFieldValues.map((cfv: any) => ({
                name: cfv.customField.name,
                label: cfv.customField.label,
                value: cfv.value,
            })),
            createdAt: item.createdAt.toISOString(),
            updatedAt: item.updatedAt.toISOString(),
        }));

        return new Response(JSON.stringify(exportData, null, 2), {
            status: 200,
            headers: {
                "Content-Type": "application/json",
                "Content-Disposition": `attachment; filename="blokhouse-export-${timestamp}.json"`,
            },
        });
    }
}
