import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

// GET /api/tags/[id] - Get a single tag
export async function GET(req, { params }) {
    const { response } = await requireAuth(req, "read");
    if (response) return response;

    const { id } = await params;
    
    try {
        const tag = await prisma.tag.findUnique({
            where: { id },
            include: {
                configurationItems: {
                    select: { id: true, name: true, ip: true, description: true }
                }
            }
        });

        if (!tag) {
            return new Response(JSON.stringify({ error: "Tag not found" }), { status: 404 });
        }

        return new Response(JSON.stringify(tag), { status: 200 });
    } catch (error) {
        console.error("Error fetching tag:", error);
        return new Response(JSON.stringify({ error: "Failed to fetch tag" }), { status: 500 });
    }
}

// PUT /api/tags/[id] - Update a tag
export async function PUT(req, { params }) {
    const { response } = await requireAuth(req, "write");
    if (response) return response;

    const { id } = await params;
    const { name, color, description } = await req.json();

    try {
        const data = {};
        if (name !== undefined) data.name = name.trim().toLowerCase();
        if (color !== undefined) data.color = color;
        if (description !== undefined) data.description = description;

        const tag = await prisma.tag.update({
            where: { id },
            data,
            include: {
                _count: {
                    select: { configurationItems: true }
                }
            }
        });

        return new Response(JSON.stringify(tag), { status: 200 });
    } catch (error) {
        if (error.code === "P2002") {
            return new Response(JSON.stringify({ error: "Tag with this name already exists" }), { status: 409 });
        }
        if (error.code === "P2025") {
            return new Response(JSON.stringify({ error: "Tag not found" }), { status: 404 });
        }
        console.error("Error updating tag:", error);
        return new Response(JSON.stringify({ error: "Failed to update tag" }), { status: 500 });
    }
}

// DELETE /api/tags/[id] - Delete a tag
export async function DELETE(req, { params }) {
    const { response } = await requireAuth(req, "write");
    if (response) return response;

    const { id } = await params;

    try {
        await prisma.tag.delete({ where: { id } });
        return new Response(JSON.stringify({ message: "Tag deleted" }), { status: 200 });
    } catch (error) {
        if (error.code === "P2025") {
            return new Response(JSON.stringify({ error: "Tag not found" }), { status: 404 });
        }
        console.error("Error deleting tag:", error);
        return new Response(JSON.stringify({ error: "Failed to delete tag" }), { status: 500 });
    }
}
