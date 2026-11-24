// app/api/types/route.js
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

export async function GET(req) {
    const { response } = await requireAuth(req, "read");
    if (response) return response;

    const types = await prisma.itemType.findMany();
    return new Response(JSON.stringify(types), { status: 200 });
}

export async function POST(request) {
    const { response } = await requireAuth(request, "write");
    if (response) return response;

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
