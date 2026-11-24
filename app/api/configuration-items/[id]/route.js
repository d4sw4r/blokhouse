import prisma from "@/lib/prisma";
import { logItemUpdated, logItemDeleted } from "@/lib/audit";
import { notifyAssetChange } from "@/lib/notifications";
import { requireAuth } from "@/lib/auth";

export async function GET(req, { params }) {
    const { response } = await requireAuth(req, "read");
    if (response) return response;

    const { id } = await params;
    const item = await prisma.configurationItem.findUnique({
        where: { id },
        include: {
            itemType: true,
            tags: true,
            customFieldValues: {
                include: { customField: true },
            },
            relationsFrom: {
                include: {
                    target: {
                        select: { id: true, name: true }
                    }
                }
            },
            relationsTo: {
                include: {
                    source: {
                        select: { id: true, name: true }
                    }
                }
            },
            maintenanceSchedules: {
                orderBy: { scheduledDate: 'asc' },
                take: 10,
            },
        },
    });

    if (!item) {
        return new Response(JSON.stringify({ error: "Not found" }), { status: 404 });
    }

    // Same shape as the list endpoint: flatten custom field values.
    const { customFieldValues = [], ...rest } = item;
    const customFields = customFieldValues.map((cfv) => ({
        id: cfv.customField.id,
        name: cfv.customField.name,
        label: cfv.customField.label,
        type: cfv.customField.type,
        value: cfv.value,
    }));

    return new Response(JSON.stringify({ ...rest, customFields }), { status: 200 });
}

export async function PUT(req, { params }) {
    const { auth, response } = await requireAuth(req, "write");
    if (response) return response;

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
        userId: auth.user.id,
        req,
    });

    // Send notification if status changed
    if (oldItem.status !== updated.status) {
        await notifyAssetChange({
            assetId: id,
            assetName: updated.name,
            type: "ASSET_STATUS_CHANGED",
            message: `Status changed from "${oldItem.status}" to "${updated.status}" by ${auth.user.name || auth.user.email}`,
            changedByUserId: auth.user.id,
        });
    }

    return new Response(JSON.stringify(updated), { status: 200 });
}

export async function DELETE(req, { params }) {
    const { auth, response } = await requireAuth(req, "write");
    if (response) return response;

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
    await logItemDeleted({ item, userId: auth.user.id, req });

    // Notify about deletion
    await notifyAssetChange({
        assetId: id,
        assetName: item.name,
        type: "ASSET_DELETED",
        message: `Asset "${item.name}" was deleted by ${auth.user.name || auth.user.email}`,
        changedByUserId: auth.user.id,
    });

    return new Response(JSON.stringify({ message: "Deleted" }), { status: 200 });
}
