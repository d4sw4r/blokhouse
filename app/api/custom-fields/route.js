// app/api/custom-fields/route.js
// Manage custom field definitions

import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import authOptions from "@/lib/authOptions";

function canWrite(role) {
    return role === "ADMIN" || role === "USER" || role === "API";
}

/**
 * @swagger
 * /api/custom-fields:
 *   get:
 *     summary: List custom field definitions
 *     description: Get all custom field definitions, optionally filtered by item type
 *     tags: [Custom Fields]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: query
 *         name: itemTypeId
 *         schema:
 *           type: string
 *         description: Filter by item type (omit for global fields)
 *     responses:
 *       200:
 *         description: List of custom field definitions
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id: { type: string }
 *                   name: { type: string }
 *                   label: { type: string }
 *                   description: { type: string, nullable: true }
 *                   type: { type: string, enum: [STRING, NUMBER, BOOLEAN, DATE, URL, EMAIL] }
 *                   required: { type: boolean }
 *                   defaultValue: { type: string, nullable: true }
 *                   options: { type: array, items: { type: string } }
 *                   itemTypeId: { type: string, nullable: true }
 *                   itemType: { type: object, nullable: true }
 *                   createdAt: { type: string, format: date-time }
 *       401:
 *         description: Unauthorized
 *   post:
 *     summary: Create a custom field definition
 *     description: Define a new custom field (Admin only)
 *     tags: [Custom Fields]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, label, type]
 *             properties:
 *               name:
 *                 type: string
 *                 description: Machine name (e.g., "purchase_date")
 *               label:
 *                 type: string
 *                 description: Display label (e.g., "Purchase Date")
 *               description:
 *                 type: string
 *               type:
 *                 type: string
 *                 enum: [STRING, NUMBER, BOOLEAN, DATE, URL, EMAIL]
 *               required:
 *                 type: boolean
 *                 default: false
 *               defaultValue:
 *                 type: string
 *               options:
 *                 type: array
 *                 items: { type: string }
 *                 description: Enum options for STRING type
 *               itemTypeId:
 *                 type: string
 *                 description: Assign to specific item type (omit for global)
 *     responses:
 *       201:
 *         description: Created custom field
 *       400:
 *         description: Bad request (missing required fields)
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (Admin only)
 *       409:
 *         description: Conflict (field with this name already exists for type)
 */
export async function GET(request) {
    const session = await getServerSession(authOptions);
    if (!session) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }

    try {
        const { searchParams } = new URL(request.url);
        const itemTypeId = searchParams.get("itemTypeId");

        const where = {};
        if (itemTypeId) {
            where.OR = [
                { itemTypeId },
                { itemTypeId: null }, // Global fields
            ];
        }

        const fields = await prisma.customField.findMany({
            where,
            include: { itemType: true },
            orderBy: { name: "asc" },
        });

        return new Response(JSON.stringify(fields), { status: 200 });
    } catch (error) {
        console.error("Error fetching custom fields:", error);
        return new Response(JSON.stringify({ error: "Failed to fetch custom fields" }), { status: 500 });
    }
}

export async function POST(request) {
    const session = await getServerSession(authOptions);
    if (!session) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }
    if (!canWrite(session.user.role)) {
        return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 });
    }

    try {
        const { name, label, description, type, required, defaultValue, options, itemTypeId } = await request.json();

        if (!name || !label || !type) {
            return new Response(JSON.stringify({ error: "name, label, and type are required" }), { status: 400 });
        }

        // Validate type
        const validTypes = ["STRING", "NUMBER", "BOOLEAN", "DATE", "URL", "EMAIL"];
        if (!validTypes.includes(type)) {
            return new Response(JSON.stringify({ error: `Invalid type. Must be one of: ${validTypes.join(", ")}` }), { status: 400 });
        }

        // Normalize name (snake_case)
        const normalizedName = name.toLowerCase().replace(/[^a-z0-9_]+/g, "_").replace(/^_+|_+$/g, "");

        const field = await prisma.customField.create({
            data: {
                name: normalizedName,
                label,
                description,
                type,
                required: required || false,
                defaultValue,
                options: options || [],
                itemTypeId: itemTypeId || null,
            },
            include: { itemType: true },
        });

        return new Response(JSON.stringify(field), { status: 201 });
    } catch (error) {
        if (error.code === "P2002") {
            return new Response(JSON.stringify({ error: "Custom field with this name already exists for this item type" }), { status: 409 });
        }
        console.error("Error creating custom field:", error);
        return new Response(JSON.stringify({ error: "Failed to create custom field" }), { status: 500 });
    }
}
