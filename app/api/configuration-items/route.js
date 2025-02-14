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
    const items = await prisma.configurationItem.findMany({ include: { itemType: true } });
    return new Response(JSON.stringify(items), { status: 200 });
}

export async function POST(request) {
    const session = await getServerSession(authOptions);
    if (!session) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }
    if (!canWrite(session.user.role)) {
        return new Response(JSON.stringify({ error: "Forbidden: Read-only access" }), { status: 403 });
    }
    const { name, description, itemTypeId, ip, mac } = await request.json();
    const item = await prisma.configurationItem.create({
        data: {
            name,
            description,
            userId: session.user.id,
            itemTypeId: itemTypeId || null,
            ip,
            mac,
        },
        include: { itemType: true },
    });
    return new Response(JSON.stringify(item), { status: 201 });
}
