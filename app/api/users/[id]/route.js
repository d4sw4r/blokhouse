// app/api/users/[id]/route.js
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import authOptions from "@/lib/authOptions";

export async function GET({ params }) {
    const { id } = await params;
    const session = await getServerSession(authOptions);
    if (!session) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }
    const user = await prisma.user.findUnique({
        where: { id },
        select: { id: true, name: true, email: true, role: true },
    });
    if (!user) {
        return new Response(JSON.stringify({ error: "Not found" }), { status: 404 });
    }
    return new Response(JSON.stringify(user), { status: 200 });
}

export async function PUT(request, { params }) {
    const { id } = await params;
    const { name, email, role } = await request.json();
    const session = await getServerSession(authOptions);
    if (!session) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }
    try {
        const updated = await prisma.user.update({
            where: { id },
            data: { name, email, role },
            select: { id: true, name: true, email: true, role: true },
        });
        return new Response(JSON.stringify(updated), { status: 200 });
    } catch (error) {
        console.error("Update user error:", error);
        return new Response(JSON.stringify({ error: "Update failed" }), { status: 500 });
    }
}

export async function DELETE({ params }) {
    const { id } = await params;
    const session = await getServerSession(authOptions);
    if (!session) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }
    try {
        await prisma.user.delete({ where: { id } });
        return new Response(JSON.stringify({ message: "Deleted" }), { status: 200 });
    } catch (error) {
        console.error("Delete user error:", error);
        return new Response(JSON.stringify({ error: "Delete failed" }), { status: 500 });
    }
}
