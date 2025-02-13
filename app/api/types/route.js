// app/api/types/route.js
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import authOptions from "@/lib/authOptions";

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

    const types = await prisma.itemType.findMany();
    return new Response(JSON.stringify(types), { status: 200 });
}

export async function POST(request) {
    // Check if there's a Bearer token in the Authorization header
    const authHeader = request.headers.get("authorization");
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

    const { name, description } = await request.json();

    try {
        const type = await prisma.itemType.create({
            data: { name, description },
        });
        return new Response(JSON.stringify(type), { status: 201 });
    } catch (error) {
        console.log(error)
        return new Response(JSON.stringify({ error: "Could not create type" }), { status: 500 });
    }
}
