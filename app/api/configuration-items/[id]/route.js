import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import authOptions from "@/lib/authOptions";

export async function GET(req, { params }) {
    const session = await getServerSession(authOptions);
    if (!session) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }

    const { id } = params;
    const item = await prisma.configurationItem.findUnique({
        where: { id },
    });

    if (!item) {
        return new Response(JSON.stringify({ error: "Not found" }), { status: 404 });
    }
    return new Response(JSON.stringify(item), { status: 200 });
}

export async function PUT(req, { params }) {
    const session = await getServerSession(authOptions);
    if (!session) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }
    const { id } = params;
    const body = await req.json();
    const { name, description, ip, mac, itemTypeId } = body;

    const updated = await prisma.configurationItem.update({
        where: { id },
        data: { name, description, ip, mac, itemTypeId },
    });

    return new Response(JSON.stringify(updated), { status: 200 });
}

export async function DELETE(req, { params }) {
    const session = await getServerSession(authOptions);
    if (!session) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }
    const { id } = params;
    await prisma.configurationItem.delete({ where: { id } });
    return new Response(JSON.stringify({ message: "Deleted" }), { status: 200 });
}
