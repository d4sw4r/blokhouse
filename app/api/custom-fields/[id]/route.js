// app/api/custom-fields/[id]/route.js

import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import authOptions from "@/lib/authOptions";

function canWrite(role) {
    return role === "ADMIN" || role === "USER" || role === "API";
}

/**
 * @swagger
 * /api/custom-fields/{id}:
 *   get:
 *     summary: Get a custom field definition
 *     description: Get a single custom field definition by ID
 *     tags: [Custom Fields]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Custom field definition
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Not found
 *   put:
 *     summary: Update a custom field definition
 *     description: Update a custom field (Admin only)
 *     tags: [Custom Fields]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               label: { type: string }
 *               description: { type: string }
 *               required: { type: boolean }
 *               defaultValue: { type: string }
 *               options: { type: array, items: { type: string } }
 *     responses:
 *       200:
 *         description: Updated custom field
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Not found
 *   delete:
 *     summary: Delete a custom field definition
 *     description: Delete a custom field and all its values (Admin only)
 *     tags: [Custom Fields]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Deleted successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Not found
 */
export async function GET(req, { params }) {
    const session = await getServerSession(authOptions);
    if (!session) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }

    const { id } = await params;

    try {
        const field = await prisma.customField.findUnique({
            where: { id },
            include: { itemType: true },
        });

        if (!field) {
            return new Response(JSON.stringify({ error: "Not found" }), { status: 404 });
        }

        return new Response(JSON.stringify(field), { status: 200 });
    } catch (error) {
        console.error("Error fetching custom field:", error);
        return new Response(JSON.stringify({ error: "Failed to fetch custom field" }), { status: 500 });
    }
}

export async function PUT(req, { params }) {
    const session = await getServerSession(authOptions);
    if (!session) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }
    if (!canWrite(session.user.role)) {
        return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 });
    }

    const { id } = await params;
    const { label, description, required, defaultValue, options } = await req.json();

    try {
        const field = await prisma.customField.update({
            where: { id },
            data: {
                ...(label !== undefined && { label }),
                ...(description !== undefined && { description }),
                ...(required !== undefined && { required }),
                ...(defaultValue !== undefined && { defaultValue }),
                ...(options !== undefined && { options }),
            },
            include: { itemType: true },
        });

        return new Response(JSON.stringify(field), { status: 200 });
    } catch (error) {
        if (error.code === "P2025") {
            return new Response(JSON.stringify({ error: "Not found" }), { status: 404 });
        }
        console.error("Error updating custom field:", error);
        return new Response(JSON.stringify({ error: "Failed to update custom field" }), { status: 500 });
    }
}

export async function DELETE(req, { params }) {
    const session = await getServerSession(authOptions);
    if (!session) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }
    if (!canWrite(session.user.role)) {
        return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 });
    }

    const { id } = await params;

    try {
        await prisma.customField.delete({ where: { id } });
        return new Response(JSON.stringify({ message: "Deleted" }), { status: 200 });
    } catch (error) {
        if (error.code === "P2025") {
            return new Response(JSON.stringify({ error: "Not found" }), { status: 404 });
        }
        console.error("Error deleting custom field:", error);
        return new Response(JSON.stringify({ error: "Failed to delete custom field" }), { status: 500 });
    }
}
