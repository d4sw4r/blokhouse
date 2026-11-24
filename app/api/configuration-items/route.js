import prisma from "@/lib/prisma";
import { requireAuth, jsonError } from "@/lib/auth";
import { logItemCreated } from "@/lib/audit";

/**
 * @swagger
 * /api/configuration-items:
 *   get:
 *     summary: List configuration items
 *     description: Get all configuration items with optional search, filtering, and pagination
 *     tags: [Configuration Items]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search across name, description, IP, and MAC
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
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Items per page
 *     responses:
 *       200:
 *         description: List of configuration items with pagination
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 items:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/ConfigurationItem'
 *                 pagination:
 *                   $ref: '#/components/schemas/Pagination'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *   post:
 *     summary: Create a configuration item
 *     description: Create a new asset in the CMDB
 *     tags: [Configuration Items]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 required: true
 *               description:
 *                 type: string
 *               ip:
 *                 type: string
 *               mac:
 *                 type: string
 *               status:
 *                 type: string
 *                 enum: [ACTIVE, DEPRECATED, MAINTENANCE]
 *                 default: ACTIVE
 *               itemTypeId:
 *                 type: string
 *               tagIds:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       201:
 *         description: Created configuration item
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ConfigurationItem'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (read-only access)
 */
export async function GET(request) {
    const { response } = await requireAuth(request, "read");
    if (response) return response;

    // Parse query parameters for search, filter, and pagination
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const typeId = searchParams.get("typeId") || "";
    const status = searchParams.get("status") || "";
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);
    const limit = Math.min(1000, Math.max(1, parseInt(searchParams.get("limit") || "10", 10) || 10));

    // Build where clause for filtering
    const where = {};

    // Search across name, description, ip, and mac fields
    if (search) {
        where.OR = [
            { name: { contains: search, mode: "insensitive" } },
            { description: { contains: search, mode: "insensitive" } },
            { ip: { contains: search, mode: "insensitive" } },
            { mac: { contains: search, mode: "insensitive" } },
        ];
    }

    // Filter by item type
    if (typeId) {
        where.itemTypeId = typeId;
    }

    // Filter by status
    if (status) {
        where.status = status;
    }

    // Calculate pagination
    const skip = (page - 1) * limit;

    // Get total count for pagination metadata
    const totalCount = await prisma.configurationItem.count({ where });

    // Fetch paginated items with tags and custom fields included
    const items = await prisma.configurationItem.findMany({
        where,
        include: {
            itemType: true,
            tags: true,
            customFieldValues: {
                include: { customField: true },
            },
        },
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
    });

    // Format items with custom fields
    const formattedItems = items.map((item) => {
        const customFields = item.customFieldValues.map((cfv) => ({
            id: cfv.customField.id,
            name: cfv.customField.name,
            label: cfv.customField.label,
            type: cfv.customField.type,
            value: cfv.value,
        }));
        return {
            ...item,
            customFields,
            customFieldValues: undefined,
        };
    });

    // Return items with pagination metadata
    return new Response(
        JSON.stringify({
            items: formattedItems,
            pagination: {
                total: totalCount,
                page,
                limit,
                totalPages: Math.ceil(totalCount / limit),
            },
        }),
        { status: 200 }
    );
}

export async function POST(request) {
    const { auth, response } = await requireAuth(request, "write");
    if (response) return response;

    let body;
    try {
        body = await request.json();
    } catch {
        return jsonError(400, "Invalid JSON body");
    }
    const { name, description, itemTypeId, ip, mac, status, tagIds } = body || {};
    if (typeof name !== "string" || !name.trim()) {
        return jsonError(400, "Field 'name' is required");
    }
    
    const data = {
        name,
        description,
        userId: auth.user.id,
        itemTypeId: itemTypeId || null,
        ip,
        mac,
        status: status || "ACTIVE",
    };

    // Add tags if provided
    if (tagIds && Array.isArray(tagIds) && tagIds.length > 0) {
        data.tags = {
            connect: tagIds.map(id => ({ id }))
        };
    }

    const item = await prisma.configurationItem.create({
        data,
        include: { itemType: true, tags: true },
    });

    // Log the creation
    await logItemCreated({ item, userId: auth.user.id, req: request });

    return new Response(JSON.stringify(item), { status: 201 });
}
