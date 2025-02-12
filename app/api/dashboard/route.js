// app/api/dashboard/route.js
import prisma from "@/lib/prisma";

export async function GET() {
    try {
        // Total configuration items.
        const totalItems = await prisma.configurationItem.count();

        // Total types.
        const totalTypes = await prisma.itemType.count();

        // Group configuration items by itemTypeId.
        // This returns an array of objects like:
        // { itemTypeId: "someId" or null, _count: { id: number } }
        const grouped = await prisma.configurationItem.groupBy({
            by: ['itemTypeId'],
            _count: { id: true },
        });

        // Separate out the group for items with a type and those without.
        const itemsPerType = [];
        let untypedItems = 0;

        for (const group of grouped) {
            if (group.itemTypeId) {
                itemsPerType.push({
                    itemTypeId: group.itemTypeId,
                    count: group._count.id,
                });
            } else {
                untypedItems = group._count.id;
            }
        }

        // For each group with an itemTypeId, fetch the type name.
        // (You could also perform a JOIN query in raw SQL, but this works fine for now.)
        for (let i = 0; i < itemsPerType.length; i++) {
            const type = await prisma.itemType.findUnique({
                where: { id: itemsPerType[i].itemTypeId },
            });
            itemsPerType[i].typeName = type ? type.name : "Unknown";
        }

        const dashboard = {
            totalItems,
            totalTypes,
            untypedItems,
            itemsPerType,
        };

        return new Response(JSON.stringify(dashboard, null, 2), {
            status: 200,
            headers: { "Content-Type": "application/json" },
        });
    } catch (error) {
        console.error("Dashboard endpoint error:", error);
        return new Response(
            JSON.stringify({ error: "Failed to load dashboard data" }),
            { status: 500 }
        );
    }
}
