import { NextRequest } from "next/server";
import { getServerSession } from "next-auth/next";
import authOptions from "@/lib/authOptions";
import prisma from "@/lib/prisma";

interface GroupByDateResult {
    createdAt: Date;
    _count: { id: number };
}

interface GroupByStatusResult {
    status: string;
    _count: { id: number };
}

interface GroupByTypeResult {
    itemTypeId: string | null;
    _count: { id: number };
}

interface GroupByRelationResult {
    type: string;
    _count: { id: number };
}

interface GroupByActionResult {
    action: string;
    _count: { id: number };
}

export async function GET(request: NextRequest) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const session = await getServerSession(authOptions as any) as any;
    if (!session?.user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
        });
    }

    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get("days") || "30", 10);

    try {
        const since = new Date();
        since.setDate(since.getDate() - days);

        // Asset creation trends over time
        const itemsOverTime = await prisma.configurationItem.groupBy({
            by: ["createdAt"],
            where: {
                createdAt: {
                    gte: since,
                },
            },
            _count: {
                id: true,
            },
            orderBy: {
                createdAt: "asc",
            },
        }) as unknown as GroupByDateResult[];

        // Aggregate by date (remove time component)
        const creationTrend: Record<string, number> = {};
        itemsOverTime.forEach((item: GroupByDateResult) => {
            const date = item.createdAt.toISOString().split("T")[0];
            creationTrend[date] = (creationTrend[date] || 0) + item._count.id;
        });

        // Items by status
        const itemsByStatus = await prisma.configurationItem.groupBy({
            by: ["status"],
            _count: {
                id: true,
            },
        }) as unknown as GroupByStatusResult[];

        // Items by type
        const itemsByType = await prisma.configurationItem.groupBy({
            by: ["itemTypeId"],
            _count: {
                id: true,
            },
        }) as unknown as GroupByTypeResult[];

        // Get type names
        const typeIds: string[] = itemsByType
            .map((i: GroupByTypeResult) => i.itemTypeId)
            .filter((id): id is string => Boolean(id));

        const types = await prisma.itemType.findMany({
            where: { id: { in: typeIds } },
            select: { id: true, name: true },
        });
        const typeMap = new Map(types.map((t: { id: string; name: string }) => [t.id, t.name]));

        // Tags distribution
        interface TagWithCount {
            id: string;
            name: string;
            color: string | null;
            _count: { configurationItems: number };
        }

        const tagsWithCount = await prisma.tag.findMany({
            include: {
                _count: {
                    select: { configurationItems: true },
                },
            },
        }) as unknown as TagWithCount[];

        // Orphaned assets (no type, no tags)
        interface OrphanedAsset {
            id: string;
            name: string;
            status: string;
            itemTypeId: string | null;
            createdAt: Date;
            _count: { tags: number };
        }

        const orphanedAssets = await prisma.configurationItem.findMany({
            where: {
                OR: [
                    { itemTypeId: null },
                    { tags: { none: {} } },
                ],
            },
            select: {
                id: true,
                name: true,
                status: true,
                itemTypeId: true,
                createdAt: true,
                _count: {
                    select: { tags: true },
                },
            },
            take: 50,
        }) as unknown as OrphanedAsset[];

        // Relation statistics
        const relationStats = await prisma.assetRelation.groupBy({
            by: ["type"],
            _count: {
                id: true,
            },
        }) as unknown as GroupByRelationResult[];

        // Recent activity summary
        const recentActivity = await prisma.auditLog.findMany({
            where: {
                createdAt: {
                    gte: since,
                },
            },
            orderBy: {
                createdAt: "desc",
            },
            take: 5,
            select: {
                id: true,
                action: true,
                entityType: true,
                description: true,
                createdAt: true,
                user: {
                    select: {
                        name: true,
                        email: true,
                    },
                },
            },
        });

        // Activity summary by action type
        const activityByAction = await prisma.auditLog.groupBy({
            by: ["action"],
            where: {
                createdAt: {
                    gte: since,
                },
            },
            _count: {
                id: true,
            },
        }) as unknown as GroupByActionResult[];

        // User statistics
        interface UserStat {
            id: string;
            name: string | null;
            email: string | null;
            _count: { configurationItems: number; auditLogs: number };
        }

        const userStats = await prisma.user.findMany({
            select: {
                id: true,
                name: true,
                email: true,
                _count: {
                    select: {
                        configurationItems: true,
                        auditLogs: true,
                    },
                },
            },
            orderBy: {
                configurationItems: {
                    _count: "desc",
                },
            },
            take: 10,
        }) as unknown as UserStat[];

        // Total counts
        const totalCounts = await Promise.all([
            prisma.configurationItem.count(),
            prisma.itemType.count(),
            prisma.tag.count(),
            prisma.assetRelation.count(),
            prisma.user.count(),
            prisma.configurationItem.count({ where: { status: "ACTIVE" } }),
            prisma.configurationItem.count({ where: { status: "DEPRECATED" } }),
            prisma.configurationItem.count({ where: { status: "MAINTENANCE" } }),
        ]);

        return new Response(JSON.stringify({
            creationTrend,
            itemsByStatus: itemsByStatus.map((s: GroupByStatusResult) => ({
                status: s.status,
                count: s._count.id,
            })),
            itemsByType: itemsByType.map((t: GroupByTypeResult) => ({
                typeId: t.itemTypeId,
                typeName: t.itemTypeId ? typeMap.get(t.itemTypeId) || "Unknown" : "Untyped",
                count: t._count.id,
            })),
            tagsDistribution: tagsWithCount.map((t: TagWithCount) => ({
                id: t.id,
                name: t.name,
                color: t.color,
                count: t._count.configurationItems,
            })),
            orphanedAssets: orphanedAssets.map((a: OrphanedAsset) => ({
                id: a.id,
                name: a.name,
                status: a.status,
                missingType: !a.itemTypeId,
                missingTags: a._count.tags === 0,
                createdAt: a.createdAt,
            })),
            relationStats: relationStats.map((r: GroupByRelationResult) => ({
                type: r.type,
                count: r._count.id,
            })),
            recentActivity,
            activityByAction: activityByAction.map((a: GroupByActionResult) => ({
                action: a.action,
                count: a._count.id,
            })),
            userStats: userStats.map((u: UserStat) => ({
                id: u.id,
                name: u.name,
                email: u.email,
                itemCount: u._count.configurationItems,
                activityCount: u._count.auditLogs,
            })),
            totals: {
                items: totalCounts[0],
                types: totalCounts[1],
                tags: totalCounts[2],
                relations: totalCounts[3],
                users: totalCounts[4],
                active: totalCounts[5],
                deprecated: totalCounts[6],
                maintenance: totalCounts[7],
            },
            period: days,
        }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
        });
    } catch (error) {
        console.error("Reports API error:", error);
        return new Response(
            JSON.stringify({ error: "Failed to generate reports" }),
            { status: 500, headers: { "Content-Type": "application/json" } }
        );
    }
}
