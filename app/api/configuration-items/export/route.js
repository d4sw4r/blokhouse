// app/api/configuration-items/export/route.js
// Export configuration items to CSV or JSON format

import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import authOptions from "@/lib/authOptions";

/**
 * @swagger
 * /api/configuration-items/export:
 *   get:
 *     summary: Export configuration items
 *     description: Export all configuration items to CSV or JSON format for backup or integration purposes
 *     tags: [Configuration Items, Export]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: query
 *         name: format
 *         schema:
 *           type: string
 *           enum: [json, csv]
 *           default: json
 *         description: Export format (json or csv)
 *       - in: query
 *         name: typeId
 *         schema:
 *           type: string
 *         description: Filter by item type ID before exporting
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [ACTIVE, DEPRECATED, MAINTENANCE]
 *         description: Filter by asset status before exporting
 *       - in: query
 *         name: includeTags
 *         schema:
 *           type: boolean
 *           default: true
 *         description: Include tags in export
 *       - in: query
 *         name: includeCustomFields
 *         schema:
 *           type: boolean
 *           default: false
 *         description: Include custom field values in export
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
 *               description: CSV formatted data
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Export failed
 */
export async function GET(request) {
    // Check authentication
    const authHeader = request.headers.get("authorization");
    let authorized = false;

    if (authHeader && authHeader.startsWith("Bearer ")) {
        const apiToken = authHeader.slice("Bearer ".length).trim();
        try {
            const tokenRecord = await prisma.apiToken.findUnique({
                where: { token: apiToken },
                include: { user: true },
            });
            if (tokenRecord && tokenRecord.user) {
                authorized = true;
            }
        } catch (error) {
            console.error("Error checking API token:", error);
        }
    }

    if (!authorized) {
        const session = await getServerSession(authOptions);
        if (!session) {
            return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
        }
    }

    try {
        const { searchParams } = new URL(request.url);
        const format = searchParams.get("format") || "json";
        const typeId = searchParams.get("typeId");
        const status = searchParams.get("status");
        const includeTags = searchParams.get("includeTags") !== "false";
        const includeCustomFields = searchParams.get("includeCustomFields") === "true";

        // Build where clause for filtering
        const where = {};
        if (typeId) {
            where.itemTypeId = typeId;
        }
        if (status) {
            where.status = status;
        }

        // Include options
        const include = {
            itemType: true,
        };

        if (includeTags) {
            include.tags = true;
        }

        if (includeCustomFields) {
            include.customFieldValues = {
                include: {
                    customField: true,
                },
            };
        }

        // Fetch all items (no pagination for export)
        const items = await prisma.configurationItem.findMany({
            where,
            include,
            orderBy: { createdAt: "desc" },
        });

        // Format the data
        const formattedItems = items.map((item) => {
            const formatted = {
                id: item.id,
                name: item.name,
                description: item.description,
                ip: item.ip,
                mac: item.mac,
                status: item.status,
                createdAt: item.createdAt,
                updatedAt: item.updatedAt,
                itemType: item.itemType?.name || null,
                itemTypeId: item.itemTypeId,
            };

            if (includeTags && item.tags) {
                formatted.tags = item.tags.map((tag) => tag.name).join(", ");
                formatted.tagIds = item.tags.map((tag) => tag.id);
            }

            if (includeCustomFields && item.customFieldValues) {
                item.customFieldValues.forEach((cfv) => {
                    formatted[`cf_${cfv.customField.name}`] = cfv.value;
                });
            }

            return formatted;
        });

        // Generate filename with timestamp
        const timestamp = new Date().toISOString().split("T")[0];
        const filename = `blokhouse-export-${timestamp}.${format}`;

        if (format === "csv") {
            // Convert to CSV
            const csv = convertToCSV(formattedItems);
            
            return new Response(csv, {
                status: 200,
                headers: {
                    "Content-Type": "text/csv; charset=utf-8",
                    "Content-Disposition": `attachment; filename="${filename}"`,
                },
            });
        } else {
            // Return JSON
            return new Response(JSON.stringify(formattedItems, null, 2), {
                status: 200,
                headers: {
                    "Content-Type": "application/json",
                    "Content-Disposition": `attachment; filename="${filename}"`,
                },
            });
        }
    } catch (error) {
        console.error("Export error:", error);
        return new Response(
            JSON.stringify({ error: "Export failed", message: error.message }),
            { status: 500 }
        );
    }
}

// Helper function to convert JSON to CSV
function convertToCSV(items) {
    if (items.length === 0) {
        return "";
    }

    // Get all unique headers
    const headers = Object.keys(items[0]);
    
    // Create CSV header row
    const headerRow = headers.map((h) => `"${h}"`).join(",");
    
    // Create data rows
    const rows = items.map((item) => {
        return headers
            .map((header) => {
                const value = item[header];
                if (value === null || value === undefined) {
                    return "";
                }
                // Escape quotes and wrap in quotes if contains comma or newline
                const strValue = String(value).replace(/"/g, '""');
                if (strValue.includes(",") || strValue.includes("\n") || strValue.includes('"')) {
                    return `"${strValue}"`;
                }
                return strValue;
            })
            .join(",");
    });

    return [headerRow, ...rows].join("\n");
}
