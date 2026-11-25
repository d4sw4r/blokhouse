import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { emitItemEvent, previousForWebhooks } from "@/lib/webhooks";

// POST /api/configuration-items/[id]/tags - Add tags to a configuration item
export async function POST(req, { params }) {
    const { auth, response } = await requireAuth(req, "write");
    if (response) return response;

    const { id } = await params;
    const { tagIds } = await req.json();

    if (!tagIds || !Array.isArray(tagIds) || tagIds.length === 0) {
        return new Response(JSON.stringify({ error: "tagIds array is required" }), { status: 400 });
    }

    try {
        const previous = await previousForWebhooks(id);
        const item = await prisma.configurationItem.update({
            where: { id },
            data: {
                tags: {
                    connect: tagIds.map(tagId => ({ id: tagId }))
                }
            },
            include: { itemType: true, tags: true }
        });

        if (previous) await emitItemEvent("item.updated", { id, previous, actor: { userId: auth.user.id, via: auth.via } });
        return new Response(JSON.stringify(item), { status: 200 });
    } catch (error) {
        if (error.code === "P2025") {
            return new Response(JSON.stringify({ error: "Configuration item not found" }), { status: 404 });
        }
        console.error("Error adding tags:", error);
        return new Response(JSON.stringify({ error: "Failed to add tags" }), { status: 500 });
    }
}

// DELETE /api/configuration-items/[id]/tags - Remove tags from a configuration item
export async function DELETE(req, { params }) {
    const { auth, response } = await requireAuth(req, "write");
    if (response) return response;

    const { id } = await params;
    const { tagIds } = await req.json();

    if (!tagIds || !Array.isArray(tagIds) || tagIds.length === 0) {
        return new Response(JSON.stringify({ error: "tagIds array is required" }), { status: 400 });
    }

    try {
        const previous = await previousForWebhooks(id);
        const item = await prisma.configurationItem.update({
            where: { id },
            data: {
                tags: {
                    disconnect: tagIds.map(tagId => ({ id: tagId }))
                }
            },
            include: { itemType: true, tags: true }
        });

        if (previous) await emitItemEvent("item.updated", { id, previous, actor: { userId: auth.user.id, via: auth.via } });
        return new Response(JSON.stringify(item), { status: 200 });
    } catch (error) {
        if (error.code === "P2025") {
            return new Response(JSON.stringify({ error: "Configuration item not found" }), { status: 404 });
        }
        console.error("Error removing tags:", error);
        return new Response(JSON.stringify({ error: "Failed to remove tags" }), { status: 500 });
    }
}
