// app/api/api-tokens/route.js
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import authOptions from "@/lib/authOptions";
import crypto from "crypto";

export async function GET() {
    const session = await getServerSession(authOptions);
    if (!session) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }
    // List tokens; here we list all tokens.
    const tokens = await prisma.apiToken.findMany({
        select: { id: true, token: true, createdAt: true }
    });
    return new Response(JSON.stringify(tokens), { status: 200 });
}

export async function POST() {
    const session = await getServerSession(authOptions);
    if (!session) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }
    // Generate a random 64-character hex token.
    const generatedToken = crypto.randomBytes(32).toString("hex");
    try {
        const newToken = await prisma.apiToken.create({
            data: {
                token: generatedToken,
                userId: session.user.id,
            },
            select: { id: true, token: true, createdAt: true }
        });
        return new Response(JSON.stringify(newToken), { status: 201 });
    } catch (error) {
        console.error("Error creating API token", error);
        return new Response(JSON.stringify({ error: "Could not create token" }), { status: 500 });
    }
}
