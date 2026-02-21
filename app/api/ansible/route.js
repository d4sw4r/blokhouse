// app/api/ansible/route.js
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import authOptions from "@/lib/authOptions";
import { buildAnsibleInventory } from "@/lib/ansible-inventory";

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

    const items = await prisma.configurationItem.findMany({
        include: { itemType: true },
    });

    const inventory = buildAnsibleInventory(items);

    return new Response(JSON.stringify(inventory, null, 2), {
        status: 200,
        headers: { "Content-Type": "application/json" },
    });
}
