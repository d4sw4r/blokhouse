// app/api/configuration-items/route.js
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import authOptions from "@/lib/authOptions"; // Make sure authOptions is now in lib/authOptions.js

export async function GET(req) {
    // Check if there's a Bearer token in the Authorization header
    const authHeader = req.headers.get("authorization");
    let authorized = false;

    if (authHeader && authHeader.startsWith("Bearer ")) {
        const apiToken = authHeader.slice("Bearer ".length).trim();
        try {
            const tokenRecord = await prisma.apiToken.findUnique({
                where: { token: apiToken },
            });
            if (tokenRecord) {
                authorized = true;
            }
        } catch (error) {
            console.error("Error checking API token:", error);
        }
    }

    // If no valid API token, then check for a valid session
    if (!authorized) {
        const session = await getServerSession(authOptions);
        if (!session) {
            return new Response(
                JSON.stringify({ error: "Unauthorized" }),
                { status: 401 }
            );
        }
    }

    // Include the related type if needed
    const items = await prisma.configurationItem.findMany({
        // where: { userId: session.user.id },
        include: { itemType: true },
    });
    return new Response(JSON.stringify(items), { status: 200 });
}

export async function POST(req) {
    // Check if there's a Bearer token in the Authorization header
    const authHeader = req.headers.get("authorization");
    let authorized = false;

    if (authHeader && authHeader.startsWith("Bearer ")) {
        const apiToken = authHeader.slice("Bearer ".length).trim();
        try {
            const tokenRecord = await prisma.apiToken.findUnique({
                where: { token: apiToken },
            });
            if (tokenRecord) {
                authorized = true;
            }
        } catch (error) {
            console.error("Error checking API token:", error);
        }
    }

    // If no valid API token, then check for a valid session
    if (!authorized) {
        const session = await getServerSession(authOptions);
        if (!session) {
            return new Response(
                JSON.stringify({ error: "Unauthorized" }),
                { status: 401 }
            );
        }
    }

    const { name, description, itemTypeId, ip, mac } = await req.json();

    const item = await prisma.configurationItem.create({
        data: {
            name,
            description,
            userId: session.user.id,
            itemTypeId: itemTypeId || null,
            ip,  // new field
            mac, // new field
        },
        include: { itemType: true },
    });

    return new Response(JSON.stringify(item), { status: 201 });
}
