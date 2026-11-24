import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

export async function GET(request: NextRequest) {
    const { auth, response } = await requireAuth(request, "read");
    if (response) return response;

    try {
        // Total counts
        const [totalItems, totalTypes, untypedItems] = await Promise.all([
            prisma.configurationItem.count(),
            prisma.itemType.count(),
            prisma.configurationItem.count({ where: { itemTypeId: null } }),
        ]);

        // Items per status
        const itemsPerStatus = await prisma.configurationItem.groupBy({
            by: ["status"],
            _count: { id: true },
        }) as Array<{ status: string; _count: { id: number } }>;

        // Items per type with type names
        const itemsPerTypeRaw = await prisma.configurationItem.groupBy({
            by: ["itemTypeId"],
            _count: { id: true },
        }) as Array<{ itemTypeId: string | null; _count: { id: number } }>;

        const typeIds = itemsPerTypeRaw
            .map((t: { itemTypeId: string | null }) => t.itemTypeId)
            .filter((id): id is string => Boolean(id));

        const types = await prisma.itemType.findMany({
            where: { id: { in: typeIds } },
            select: { id: true, name: true },
        }) as Array<{ id: string; name: string }>;
        const typeMap = new Map(types.map((t: { id: string; name: string }) => [t.id, t.name]));

        const itemsPerType = itemsPerTypeRaw.map((t: { itemTypeId: string | null; _count: { id: number } }) => ({
            itemTypeId: t.itemTypeId || "untyped",
            count: t._count.id,
            typeName: t.itemTypeId ? typeMap.get(t.itemTypeId) || "Unknown" : "Untyped",
        }));

        // Additional stats
        const [totalTags, totalRelations, upcomingMaintenance, unreadNotifications] = await Promise.all([
            prisma.tag.count(),
            prisma.assetRelation.count(),
            prisma.maintenanceSchedule.count({
                where: {
                    scheduledDate: { gte: new Date() },
                    status: { in: ["SCHEDULED", "IN_PROGRESS"] },
                },
            }),
            prisma.notification.count({
                where: {
                    userId: auth.user.id,
                    read: false,
                },
            }),
        ]);

        return new Response(
            JSON.stringify({
                totalItems,
                totalTypes,
                untypedItems,
                totalTags,
                totalRelations,
                upcomingMaintenance,
                unreadNotifications,
                itemsPerStatus: itemsPerStatus.map((s: { status: string; _count: { id: number } }) => ({
                    status: s.status,
                    count: s._count.id,
                })),
                itemsPerType,
            }),
            {
                status: 200,
                headers: { "Content-Type": "application/json" },
            }
        );
    } catch (error) {
        console.error("Dashboard API error:", error);
        return new Response(
            JSON.stringify({ error: "Failed to fetch dashboard data" }),
            { status: 500, headers: { "Content-Type": "application/json" } }
        );
    }
}
