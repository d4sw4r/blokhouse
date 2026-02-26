// app/api/search/route.ts
import { NextRequest } from "next/server";
import { getServerSession } from "next-auth/next";
import authOptions from "@/lib/authOptions";
import prisma from "@/lib/prisma";

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
    const query = searchParams.get("q")?.trim().toLowerCase() || "";

    if (!query || query.length < 2) {
        return new Response(JSON.stringify({ results: [] }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
        });
    }

    try {
        // Search Configuration Items
        const items = await prisma.configurationItem.findMany({
            where: {
                OR: [
                    { name: { contains: query, mode: "insensitive" } },
                    { description: { contains: query, mode: "insensitive" } },
                    { ip: { contains: query, mode: "insensitive" } },
                ],
            },
            select: {
                id: true,
                name: true,
                description: true,
                status: true,
                itemType: { select: { name: true } },
            },
            take: 5,
        });

        // Search Item Types
        const types = await prisma.itemType.findMany({
            where: {
                OR: [
                    { name: { contains: query, mode: "insensitive" } },
                    { description: { contains: query, mode: "insensitive" } },
                ],
            },
            select: {
                id: true,
                name: true,
                description: true,
            },
            take: 3,
        });

        // Search Tags
        const tags = await prisma.tag.findMany({
            where: {
                OR: [
                    { name: { contains: query, mode: "insensitive" } },
                    { description: { contains: query, mode: "insensitive" } },
                ],
            },
            select: {
                id: true,
                name: true,
                color: true,
            },
            take: 3,
        });

        const results = [
            ...items.map((item: { id: string; name: string; description: string | null; status: string; itemType: { name: string } | null }) => ({
                id: item.id,
                type: "item" as const,
                title: item.name,
                subtitle: item.description || item.itemType?.name || "Configuration Item",
                status: item.status,
                href: `/items?id=${item.id}`,
            })),
            ...types.map((type: { id: string; name: string; description: string | null }) => ({
                id: type.id,
                type: "type" as const,
                title: type.name,
                subtitle: type.description || "Item Type",
                href: `/types`,
            })),
            ...tags.map((tag: { id: string; name: string; color: string | null }) => ({
                id: tag.id,
                type: "tag" as const,
                title: tag.name,
                subtitle: "Tag",
                color: tag.color,
                href: `/items?tag=${tag.id}`,
            })),
        ];

        return new Response(JSON.stringify({ results, query }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
        });
    } catch (error) {
        console.error("Search error:", error);
        return new Response(
            JSON.stringify({ error: "Search failed" }),
            { status: 500, headers: { "Content-Type": "application/json" } }
        );
    }
}
