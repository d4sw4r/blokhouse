import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import authOptions from "@/lib/authOptions";

// Helper to check if the user can write (ADMIN, USER, API)
function canWrite(role) {
    return role === "ADMIN" || role === "USER" || role === "API";
}

// GET /api/tags - List all tags
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

    try {
        const tags = await prisma.tag.findMany({
            include: {
                _count: {
                    select: { configurationItems: true }
                }
            },
            orderBy: { name: "asc" }
        });
        return new Response(JSON.stringify(tags), { status: 200 });
    } catch (error) {
        console.error("Error fetching tags:", error);
        return new Response(JSON.stringify({ error: "Failed to fetch tags" }), { status: 500 });
    }
}

// POST /api/tags - Create a new tag
export async function POST(request) {
    const session = await getServerSession(authOptions);
    if (!session) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }
    if (!canWrite(session.user.role)) {
        return new Response(JSON.stringify({ error: "Forbidden: Read-only access" }), { status: 403 });
    }

    try {
        const { name, color, description } = await request.json();
        
        if (!name || name.trim() === "") {
            return new Response(JSON.stringify({ error: "Tag name is required" }), { status: 400 });
        }

        // Normalize tag name (lowercase, trim)
        const normalizedName = name.trim().toLowerCase();

        const tag = await prisma.tag.create({
            data: {
                name: normalizedName,
                color: color || null,
                description: description || null,
            },
            include: {
                _count: {
                    select: { configurationItems: true }
                }
            }
        });
        return new Response(JSON.stringify(tag), { status: 201 });
    } catch (error) {
        if (error.code === "P2002") {
            return new Response(JSON.stringify({ error: "Tag with this name already exists" }), { status: 409 });
        }
        console.error("Error creating tag:", error);
        return new Response(JSON.stringify({ error: "Failed to create tag" }), { status: 500 });
    }
}
