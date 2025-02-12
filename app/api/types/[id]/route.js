// app/api/types/[id]/route.js
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import authOptions from "@/lib/authOptions";

export async function GET(request, { params }) {
    const session = await getServerSession(authOptions);
    if (!session) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }

    const { id } = params;
    const type = await prisma.itemType.findUnique({ where: { id } });
    if (!type) {
        return new Response(JSON.stringify({ error: "Not found" }), { status: 404 });
    }
    return new Response(JSON.stringify(type), { status: 200 });
}

export async function PUT(request, { params }) {
    const session = await getServerSession(authOptions);
    if (!session) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }

    const { id } = params;
    const { name, description } = await request.json();

    try {
        const updatedType = await prisma.itemType.update({
            where: { id },
            data: { name, description },
        });
        return new Response(JSON.stringify(updatedType), { status: 200 });
    } catch (error) {
        console.log(error)
        return new Response(JSON.stringify({ error: "Update failed" }), { status: 500 });
    }
}

export async function DELETE(request, { params }) {
    const session = await getServerSession(authOptions);
    if (!session) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }

    const { id } = params;
    try {
        await prisma.itemType.delete({ where: { id } });
        return new Response(JSON.stringify({ message: "Deleted" }), { status: 200 });
    } catch (error) {
        console.log(error)
        return new Response(JSON.stringify({ error: "Delete failed" }), { status: 500 });
    }
}
