import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import authOptions from "@/lib/authOptions";
import { logItemUpdated, logItemDeleted } from "@/lib/audit";
import { notifyAssetChange } from "@/lib/notifications";

export async function GET(req, { params }) {
    const session = await getServerSession(authOptions);
    if (!session) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }

    const { id } = await params;
    const item = await prisma.configurationItem.findUnique({
        where: { id },
        include: {
            itemType: true,
            tags: true,
            customFieldValues: {
                include: { customField: true },
            },
        },
    });

    if (!item) {
        return new Response(JSON.stringify({ error: "Not found" }), { status: 404 });
    }

    // Format custom fields
    const customFields = item.customFieldValues.map((cfv) => ({
        id: cfv.customField.id,
        name: cfv.customField.name,
        label: cfv.customField.label,
        type: cfv.customField.type,
        value: cfv.value,
    }));

    const result = {
        ...item,
        customFields,
    };
    delete result.customFieldValues;

    return new Response(JSON.stringify(result), { status: 200 });
}

export async function PUT(req, { params }) {
    const session = await getServerSession(authOptions);
    if (!session) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();
    const { name, description, ip, mac, itemTypeId, status, tagIds } = body;

    // Fetch the old item for audit logging
    const oldItem = await prisma.configurationItem.findUnique({
        where: { id },
        include: { itemType: true, tags: true },
    });

    if (!oldItem) {
        return new Response(JSON.stringify({ error: "Not found" }), { status: 404 });
    }

    const data = { name, description, ip, mac, itemTypeId, status };

    // Handle tag updates if provided
    if (tagIds !== undefined && Array.isArray(tagIds)) {
        data.tags = {
            set: tagIds.map(tagId => ({ id: tagId }))
        };
    }

    const updated = await prisma.configurationItem.update({
        where: { id },
        data,
        include: { itemType: true, tags: true },
    });

    // Log the update
    await logItemUpdated({
        oldItem,
        newItem: updated,
        userId: session.user.id,
        req,
    });

    // Send notification if status changed
    if (oldItem.status !== updated.status) {
        await notifyAssetChange({
            assetId: id,
            assetName: updated.name,
            type: "ASSET_STATUS_CHANGED",
            message: `Status changed from "${oldItem.status}" to "${updated.status}" by ${session.user.name || session.user.email}`,
            changedByUserId: session.user.id,
        });
    }

    return new Response(JSON.stringify(updated), { status: 200 });
}

export async function DELETE(req, { params }) {
    const session = await getServerSession(authOptions);
    if (!session) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }

    const { id } = await params;

    // Fetch the item before deleting for audit logging
    const item = await prisma.configurationItem.findUnique({
        where: { id },
        include: { itemType: true, tags: true },
    });

    if (!item) {
        return new Response(JSON.stringify({ error: "Not found" }), { status: 404 });
    }

    await prisma.configurationItem.delete({ where: { id } });

    // Log the deletion
    await logItemDeleted({ item, userId: session.user.id, req });

    // Notify about deletion
    await notifyAssetChange({
        assetId: id,
        assetName: item.name,
        type: "ASSET_DELETED",
        message: `Asset "${item.name}" was deleted by ${session.user.name || session.user.email}`,
        changedByUserId: session.user.id,
    });

    return new Response(JSON.stringify({ message: "Deleted" }), { status: 200 });
}
