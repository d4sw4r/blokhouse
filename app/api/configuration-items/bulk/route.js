// app/api/configuration-items/bulk/route.js
// Bulk operations for configuration items - delete, update status, manage tags

import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import authOptions from "@/lib/authOptions";
import { logItemUpdated, logItemDeleted } from "@/lib/audit";

// Helper to check if the user can write (ADMIN, USER, API)
function canWrite(role) {
    return role === "ADMIN" || role === "USER" || role === "API";
}

/**
 * @swagger
 * /api/configuration-items/bulk:
 *   post:
 *     summary: Bulk operations on configuration items
 *     description: Perform bulk delete, status update, or tag operations on multiple configuration items at once
 *     tags: [Configuration Items, Bulk Operations]
 *     security:
 *       - cookieAuth: []
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - operation
 *               - ids
 *             properties:
 *               operation:
 *                 type: string
 *                 enum: [delete, updateStatus, addTags, removeTags, setTags]
 *                 description: The bulk operation to perform
 *               ids:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Array of configuration item IDs to operate on
 *               status:
 *                 type: string
 *                 enum: [ACTIVE, DEPRECATED, MAINTENANCE]
 *                 description: New status (required for updateStatus operation)
 *               tagIds:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Array of tag IDs (required for addTags, removeTags, setTags operations)
 *     responses:
 *       200:
 *         description: Bulk operation completed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 operation:
 *                   type: string
 *                 processed:
 *                   type: integer
 *                   description: Number of items processed
 *                 failed:
 *                   type: integer
 *                   description: Number of items that failed
 *                 errors:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       error:
 *                         type: string
 *       400:
 *         description: Bad request (invalid operation or missing parameters)
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (read-only access)
 *       404:
 *         description: No valid items found for the provided IDs
 */
export async function POST(request) {
    // Check authentication
    const authHeader = request.headers.get("authorization");
    let userId = null;
    let userRole = null;
    let authorized = false;

    if (authHeader && authHeader.startsWith("Bearer ")) {
        const apiToken = authHeader.slice("Bearer ".length).trim();
        try {
            const tokenRecord = await prisma.apiToken.findUnique({
                where: { token: apiToken },
                include: { user: true },
            });
            if (tokenRecord && tokenRecord.user) {
                userId = tokenRecord.user.id;
                userRole = tokenRecord.user.role;
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
        userId = session.user.id;
        userRole = session.user.role;
    }

    // Check write permissions
    if (!canWrite(userRole)) {
        return new Response(JSON.stringify({ error: "Forbidden: Read-only access" }), { status: 403 });
    }

    try {
        const body = await request.json();
        const { operation, ids, status, tagIds } = body;

        // Validate required fields
        if (!operation || !ids || !Array.isArray(ids) || ids.length === 0) {
            return new Response(
                JSON.stringify({ error: "Missing required fields: operation and ids (non-empty array)" }),
                { status: 400 }
            );
        }

        // Validate operation type
        const validOperations = ["delete", "updateStatus", "addTags", "removeTags", "setTags"];
        if (!validOperations.includes(operation)) {
            return new Response(
                JSON.stringify({ error: `Invalid operation. Must be one of: ${validOperations.join(", ")}` }),
                { status: 400 }
            );
        }

        // Validate operation-specific parameters
        if (operation === "updateStatus" && !status) {
            return new Response(
                JSON.stringify({ error: "Missing required field: status (for updateStatus operation)" }),
                { status: 400 }
            );
        }

        if (["addTags", "removeTags", "setTags"].includes(operation) && (!tagIds || !Array.isArray(tagIds))) {
            return new Response(
                JSON.stringify({ error: "Missing required field: tagIds (array for tag operations)" }),
                { status: 400 }
            );
        }

        // Verify items exist and count them
        const existingItems = await prisma.configurationItem.findMany({
            where: { id: { in: ids } },
            select: { id: true, name: true },
        });

        if (existingItems.length === 0) {
            return new Response(
                JSON.stringify({ error: "No valid configuration items found for the provided IDs" }),
                { status: 404 }
            );
        }

        const existingIds = existingItems.map(item => item.id);
        const notFoundIds = ids.filter(id => !existingIds.includes(id));
        
        let processed = 0;
        let failed = 0;
        const errors = [];

        // Perform the bulk operation
        switch (operation) {
            case "delete": {
                // Delete items one by one to log each deletion
                for (const item of existingItems) {
                    try {
                        await prisma.configurationItem.delete({
                            where: { id: item.id },
                        });
                        await logItemDeleted({
                            item,
                            userId,
                            req: request,
                        });
                        processed++;
                    } catch (error) {
                        console.error(`Error deleting item ${item.id}:`, error);
                        failed++;
                        errors.push({ id: item.id, error: error.message });
                    }
                }
                break;
            }

            case "updateStatus": {
                // Validate status value
                const validStatuses = ["ACTIVE", "DEPRECATED", "MAINTENANCE"];
                if (!validStatuses.includes(status)) {
                    return new Response(
                        JSON.stringify({ error: `Invalid status. Must be one of: ${validStatuses.join(", ")}` }),
                        { status: 400 }
                    );
                }

                // Update status for all items
                for (const item of existingItems) {
                    try {
                        const oldItem = await prisma.configurationItem.findUnique({
                            where: { id: item.id },
                            include: { itemType: true, tags: true },
                        });

                        const updatedItem = await prisma.configurationItem.update({
                            where: { id: item.id },
                            data: { status },
                            include: { itemType: true, tags: true },
                        });

                        await logItemUpdated({
                            oldItem,
                            newItem: updatedItem,
                            userId,
                            req: request,
                            changes: { status: { old: oldItem.status, new: status } },
                        });
                        processed++;
                    } catch (error) {
                        console.error(`Error updating status for item ${item.id}:`, error);
                        failed++;
                        errors.push({ id: item.id, error: error.message });
                    }
                }
                break;
            }

            case "addTags": {
                // Add tags to items
                for (const item of existingItems) {
                    try {
                        await prisma.configurationItem.update({
                            where: { id: item.id },
                            data: {
                                tags: {
                                    connect: tagIds.map(id => ({ id })),
                                },
                            },
                        });
                        processed++;
                    } catch (error) {
                        console.error(`Error adding tags to item ${item.id}:`, error);
                        failed++;
                        errors.push({ id: item.id, error: error.message });
                    }
                }
                break;
            }

            case "removeTags": {
                // Remove tags from items
                for (const item of existingItems) {
                    try {
                        await prisma.configurationItem.update({
                            where: { id: item.id },
                            data: {
                                tags: {
                                    disconnect: tagIds.map(id => ({ id })),
                                },
                            },
                        });
                        processed++;
                    } catch (error) {
                        console.error(`Error removing tags from item ${item.id}:`, error);
                        failed++;
                        errors.push({ id: item.id, error: error.message });
                    }
                }
                break;
            }

            case "setTags": {
                // Set (replace) tags for items
                for (const item of existingItems) {
                    try {
                        await prisma.configurationItem.update({
                            where: { id: item.id },
                            data: {
                                tags: {
                                    set: tagIds.map(id => ({ id })),
                                },
                            },
                        });
                        processed++;
                    } catch (error) {
                        console.error(`Error setting tags for item ${item.id}:`, error);
                        failed++;
                        errors.push({ id: item.id, error: error.message });
                    }
                }
                break;
            }
        }

        // Build response
        const response = {
            success: failed === 0,
            operation,
            processed,
            failed,
            totalRequested: ids.length,
            notFound: notFoundIds.length > 0 ? notFoundIds : undefined,
        };

        if (errors.length > 0) {
            response.errors = errors;
        }

        return new Response(JSON.stringify(response), {
            status: failed === 0 ? 200 : 207, // 207 Multi-Status if some failed
            headers: { "Content-Type": "application/json" },
        });

    } catch (error) {
        console.error("Error in bulk operation:", error);
        return new Response(
            JSON.stringify({ error: "Internal server error", message: error.message }),
            { status: 500 }
        );
    }
}

/**
 * @swagger
 * /api/configuration-items/bulk:
 *   get:
 *     summary: Get bulk operation info
 *     description: Returns information about available bulk operations and their parameters
 *     tags: [Configuration Items, Bulk Operations]
 *     responses:
 *       200:
 *         description: Information about available bulk operations
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 operations:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       name:
 *                         type: string
 *                       description:
 *                         type: string
 *                       requiredParams:
 *                         type: array
 *                         items:
 *                           type: string
 */
export async function GET() {
    return new Response(
        JSON.stringify({
            operations: [
                {
                    name: "delete",
                    description: "Delete multiple configuration items",
                    requiredParams: ["ids"],
                },
                {
                    name: "updateStatus",
                    description: "Update status of multiple configuration items",
                    requiredParams: ["ids", "status"],
                    validStatusValues: ["ACTIVE", "DEPRECATED", "MAINTENANCE"],
                },
                {
                    name: "addTags",
                    description: "Add tags to multiple configuration items",
                    requiredParams: ["ids", "tagIds"],
                },
                {
                    name: "removeTags",
                    description: "Remove tags from multiple configuration items",
                    requiredParams: ["ids", "tagIds"],
                },
                {
                    name: "setTags",
                    description: "Set (replace) tags for multiple configuration items",
                    requiredParams: ["ids", "tagIds"],
                },
            ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
    );
}
