// app/api/configuration-items/[id]/custom-fields/route.js
// Manage custom field values for a configuration item

import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import authOptions from "@/lib/authOptions";

function canWrite(role) {
    return role === "ADMIN" || role === "USER" || role === "API";
}

/**
 * @swagger
 * /api/configuration-items/{id}/custom-fields:
 *   get:
 *     summary: Get custom field values for an item
 *     description: Get all custom field values for a specific configuration item
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
 *         description: Configuration item ID
 *     responses:
 *       200:
 *         description: Custom field values
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id: { type: string }
 *                   value: { type: string }
 *                   customFieldId: { type: string }
 *                   customField:
 *                     type: object
 *                     properties:
 *                       id: { type: string }
 *                       name: { type: string }
 *                       label: { type: string }
 *                       type: { type: string }
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Item not found
 *   put:
 *     summary: Update custom field values
 *     description: Set/update custom field values for a configuration item
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
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               values:
 *                 type: object
 *                 description: Object with customFieldId as keys and values as values
 *                 example:
 *                   cf_abc123: "2024-01-15"
 *                   cf_def456: "Dell"
 *     responses:
 *       200:
 *         description: Updated values
 *       400:
 *         description: Bad request (validation error)
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Item or field not found
 */
export async function GET(req, { params }) {
    const session = await getServerSession(authOptions);
    if (!session) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }

    const { id } = await params;

    try {
        // Check if item exists
        const item = await prisma.configurationItem.findUnique({
            where: { id },
            include: { itemType: true },
        });

        if (!item) {
            return new Response(JSON.stringify({ error: "Configuration item not found" }), { status: 404 });
        }

        // Get applicable custom fields (global + item type specific)
        const fields = await prisma.customField.findMany({
            where: {
                OR: [
                    { itemTypeId: null }, // Global fields
                    { itemTypeId: item.itemTypeId }, // Type-specific fields
                ],
            },
            include: {
                values: {
                    where: { configurationItemId: id },
                },
            },
            orderBy: { name: "asc" },
        });

        // Format response
        const result = fields.map((field) => ({
            id: field.id,
            name: field.name,
            label: field.label,
            description: field.description,
            type: field.type,
            required: field.required,
            defaultValue: field.defaultValue,
            options: field.options,
            value: field.values[0]?.value || field.defaultValue || null,
            valueId: field.values[0]?.id || null,
        }));

        return new Response(JSON.stringify(result), { status: 200 });
    } catch (error) {
        console.error("Error fetching custom field values:", error);
        return new Response(JSON.stringify({ error: "Failed to fetch custom field values" }), { status: 500 });
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
    const { values } = await req.json();

    if (!values || typeof values !== "object") {
        return new Response(JSON.stringify({ error: "values object is required" }), { status: 400 });
    }

    try {
        // Check if item exists
        const item = await prisma.configurationItem.findUnique({
            where: { id },
            include: { itemType: true },
        });

        if (!item) {
            return new Response(JSON.stringify({ error: "Configuration item not found" }), { status: 404 });
        }

        // Get applicable fields for validation
        const applicableFields = await prisma.customField.findMany({
            where: {
                OR: [
                    { itemTypeId: null },
                    { itemTypeId: item.itemTypeId },
                ],
            },
        });

        const applicableFieldIds = applicableFields.map((f) => f.id);
        const results = [];

        // Process each value
        for (const [fieldId, value] of Object.entries(values)) {
            // Skip if field not applicable to this item
            if (!applicableFieldIds.includes(fieldId)) {
                continue;
            }

            const field = applicableFields.find((f) => f.id === fieldId);

            // Validate value
            const validation = validateValue(value, field);
            if (!validation.valid) {
                return new Response(
                    JSON.stringify({ error: `Invalid value for ${field.name}: ${validation.error}` }),
                    { status: 400 }
                );
            }

            // Upsert the value
            const fieldValue = await prisma.customFieldValue.upsert({
                where: {
                    customFieldId_configurationItemId: {
                        customFieldId: fieldId,
                        configurationItemId: id,
                    },
                },
                update: { value: value === null ? "" : String(value) },
                create: {
                    customFieldId: fieldId,
                    configurationItemId: id,
                    value: value === null ? "" : String(value),
                },
                include: { customField: true },
            });

            results.push(fieldValue);
        }

        return new Response(JSON.stringify(results), { status: 200 });
    } catch (error) {
        console.error("Error updating custom field values:", error);
        return new Response(JSON.stringify({ error: "Failed to update custom field values" }), { status: 500 });
    }
}

// Validate value based on field type
function validateValue(value, field) {
    if (value === null || value === undefined || value === "") {
        if (field.required) {
            return { valid: false, error: "Field is required" };
        }
        return { valid: true };
    }

    const strValue = String(value);

    switch (field.type) {
        case "NUMBER":
            if (isNaN(Number(strValue))) {
                return { valid: false, error: "Must be a number" };
            }
            break;
        case "BOOLEAN":
            if (!["true", "false", "1", "0", "yes", "no"].includes(strValue.toLowerCase())) {
                return { valid: false, error: "Must be a boolean" };
            }
            break;
        case "DATE":
            if (isNaN(Date.parse(strValue))) {
                return { valid: false, error: "Must be a valid date" };
            }
            break;
        case "URL":
            try {
                new URL(strValue);
            } catch {
                return { valid: false, error: "Must be a valid URL" };
            }
            break;
        case "EMAIL":
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(strValue)) {
                return { valid: false, error: "Must be a valid email" };
            }
            break;
        case "STRING":
            // Check if value is in options (if defined)
            if (field.options && field.options.length > 0 && !field.options.includes(strValue)) {
                return { valid: false, error: `Must be one of: ${field.options.join(", ")}` };
            }
            break;
    }

    return { valid: true };
}
