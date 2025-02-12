// app/api/types/route.js
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import authOptions from "@/lib/authOptions";

export async function GET() {
    const session = await getServerSession(authOptions);
    if (!session) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }

    const types = await prisma.itemType.findMany();
    return new Response(JSON.stringify(types), { status: 200 });
}

export async function POST(request) {
    const session = await getServerSession(authOptions);
    if (!session) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
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
