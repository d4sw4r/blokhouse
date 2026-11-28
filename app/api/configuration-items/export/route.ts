import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { buildConfigurationItemsWhere } from "@/lib/configurationItemsWhere";

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
 *         name: tagId
 *         schema:
 *           type: string
 *         description: Only items that carry this tag
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Case-insensitive search in name, description, IP and MAC (same as the list endpoint)
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
    const { response } = await requireAuth(request, "read");
    if (response) return response;

    const { searchParams } = new URL(request.url);
    const format = searchParams.get("format") || "json";
    const typeId = searchParams.get("typeId") || "";
    const status = searchParams.get("status") || "";
    const tagId = searchParams.get("tagId") || "";
    const search = searchParams.get("search") || "";
    const includeTags = searchParams.get("includeTags") !== "false";

    // Same filters as GET /api/configuration-items
    const where = buildConfigurationItemsWhere({ search, typeId, status, tagId });

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
            item.tags?.map((t: { name: string }) => t.name).join("; ") || "",
            item.createdAt.toISOString(),
            item.updatedAt.toISOString(),
        ]);

        const csvContent = [
            headers.join(","),
            ...rows.map((row: string[]) => row.map(escapeCSV).join(",")),
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
            tags: item.tags?.map((t: { name: string; color: string }) => ({ name: t.name, color: t.color })) || [],
            customFields: item.customFieldValues.map((cfv: { customField: { name: string; label: string }; value: string }) => ({
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
