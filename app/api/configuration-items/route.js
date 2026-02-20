import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import authOptions from "@/lib/authOptions";

// Helper to check if the user can write (ADMIN, USER, API)
function canWrite(role) {
    return role === "ADMIN" || role === "USER" || role === "API";
}

export async function GET(request) {
    const authHeader = request.headers.get("authorization");
    let authorized = false;
    if (authHeader && authHeader.startsWith("Bearer ")) {
        const apiToken = authHeader.slice("Bearer ".length).trim();
        try {
            const tokenRecord = await prisma.apiToken.findUnique({ where: { token: apiToken } });
            if (tokenRecord) authorized = true;
        } catch (error) {
            console.error("Error checking API token:", error);
        }
    }
    if (!authorized) {
        const session = await getServerSession(authOptions);
        if (!session) {
            return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
        }
    }

    // Parse query parameters for search, filter, and pagination
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const typeId = searchParams.get("typeId") || "";
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "10", 10);

    // Build where clause for filtering
    const where = {};

    // Search across name, description, ip, and mac fields
    if (search) {
        where.OR = [
            { name: { contains: search, mode: "insensitive" } },
            { description: { contains: search, mode: "insensitive" } },
            { ip: { contains: search, mode: "insensitive" } },
            { mac: { contains: search, mode: "insensitive" } },
        ];
    }

    // Filter by item type
    if (typeId) {
        where.itemTypeId = typeId;
    }

    // Calculate pagination
    const skip = (page - 1) * limit;

    // Get total count for pagination metadata
    const totalCount = await prisma.configurationItem.count({ where });

    // Fetch paginated items with tags included
    const items = await prisma.configurationItem.findMany({
        where,
        include: { itemType: true, tags: true },
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
    });

    // Return items with pagination metadata
    return new Response(
        JSON.stringify({
            items,
            pagination: {
                total: totalCount,
                page,
                limit,
                totalPages: Math.ceil(totalCount / limit),
            },
        }),
        { status: 200 }
    );
}

export async function POST(request) {
    const session = await getServerSession(authOptions);
    if (!session) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }
    if (!canWrite(session.user.role)) {
        return new Response(JSON.stringify({ error: "Forbidden: Read-only access" }), { status: 403 });
    }
    const { name, description, itemTypeId, ip, mac, tagIds } = await request.json();
    
    const data = {
        name,
        description,
        userId: session.user.id,
        itemTypeId: itemTypeId || null,
        ip,
        mac,
    };

    // Add tags if provided
    if (tagIds && Array.isArray(tagIds) && tagIds.length > 0) {
        data.tags = {
            connect: tagIds.map(id => ({ id }))
        };
    }

    const item = await prisma.configurationItem.create({
        data,
        include: { itemType: true, tags: true },
    });
    return new Response(JSON.stringify(item), { status: 201 });
}
