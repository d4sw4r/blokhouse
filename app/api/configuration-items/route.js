import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import authOptions from "@/lib/authOptions";
import { logItemCreated } from "@/lib/audit";

// Helper to check if the user can write (ADMIN, USER, API)
function canWrite(role) {
    return role === "ADMIN" || role === "USER" || role === "API";
}

// Helper to get user ID from session or API token
async function getUserIdFromRequest(request) {
    const authHeader = request.headers.get("authorization");
    if (authHeader && authHeader.startsWith("Bearer ")) {
        const apiToken = authHeader.slice("Bearer ".length).trim();
        try {
            const tokenRecord = await prisma.apiToken.findUnique({
                where: { token: apiToken },
                include: { user: true },
            });
            if (tokenRecord && tokenRecord.user) {
                return { userId: tokenRecord.user.id, authorized: true };
            }
        } catch (error) {
            console.error("Error checking API token:", error);
        }
    }
    const session = await getServerSession(authOptions);
    if (session?.user?.id) {
        return { userId: session.user.id, authorized: true, session };
    }
    return { authorized: false };
}

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
    const { authorized } = await getUserIdFromRequest(request);
    if (!authorized) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }

    // Parse query parameters for search, filter, and pagination
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const typeId = searchParams.get("typeId") || "";
    const status = searchParams.get("status") || "";
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "10", 10);

    // Build where clause for filtering
    const where = {};

    // Search across name, description, ip, and mac fields
    if (search) {
        where.OR = [
            { name: { contains: search } },
            { description: { contains: search } },
            { ip: { contains: search } },
            { mac: { contains: search } },
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
    const session = await getServerSession(authOptions);
    if (!session) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }
    if (!canWrite(session.user.role)) {
        return new Response(JSON.stringify({ error: "Forbidden: Read-only access" }), { status: 403 });
    }

    const { name, description, itemTypeId, ip, mac, status, tagIds } = await request.json();
    
    const data = {
        name,
        description,
        userId: session.user.id,
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
    await logItemCreated({ item, userId: session.user.id, req: request });

    return new Response(JSON.stringify(item), { status: 201 });
}
