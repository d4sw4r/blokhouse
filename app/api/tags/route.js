import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

/**
 * @swagger
 * /api/tags:
 *   get:
 *     summary: List all tags
 *     description: Get all tags with usage count
 *     tags: [Tags]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: List of tags
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Tag'
 *       401:
 *         description: Unauthorized
 *   post:
 *     summary: Create a tag
 *     description: Create a new tag for labeling assets
 *     tags: [Tags]
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
 *               color:
 *                 type: string
 *                 description: Hex color code (e.g., #ff0000)
 *               description:
 *                 type: string
 *     responses:
 *       201:
 *         description: Created tag
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Tag'
 *       400:
 *         description: Bad request (missing name)
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       409:
 *         description: Conflict (tag already exists)
 */
export async function GET(request) {
    const { response } = await requireAuth(request, "read");
    if (response) return response;

    try {
        const tags = await prisma.tag.findMany({
            include: {
                _count: {
                    select: { configurationItems: true }
                }
            },
            orderBy: { name: "asc" }
        });
        return new Response(JSON.stringify(tags), { status: 200 });
    } catch (error) {
        console.error("Error fetching tags:", error);
        return new Response(JSON.stringify({ error: "Failed to fetch tags" }), { status: 500 });
    }
}

export async function POST(request) {
    const { response } = await requireAuth(request, "write");
    if (response) return response;

    try {
        const { name, color, description } = await request.json();
        
        if (!name || name.trim() === "") {
            return new Response(JSON.stringify({ error: "Tag name is required" }), { status: 400 });
        }

        // Normalize tag name (lowercase, trim)
        const normalizedName = name.trim().toLowerCase();

        const tag = await prisma.tag.create({
            data: {
                name: normalizedName,
                color: color || null,
                description: description || null,
            },
            include: {
                _count: {
                    select: { configurationItems: true }
                }
            }
        });
        return new Response(JSON.stringify(tag), { status: 201 });
    } catch (error) {
        if (error.code === "P2002") {
            return new Response(JSON.stringify({ error: "Tag with this name already exists" }), { status: 409 });
        }
        console.error("Error creating tag:", error);
        return new Response(JSON.stringify({ error: "Failed to create tag" }), { status: 500 });
    }
}
