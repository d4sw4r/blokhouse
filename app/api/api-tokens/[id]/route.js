// app/api/api-tokens/[id]/route.js
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import authOptions from "@/lib/authOptions";

export async function DELETE(request, { params }) {
    const session = await getServerSession(authOptions);
    if (!session) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }
    const { id } = params;
    try {
        await prisma.apiToken.delete({ where: { id } });
        return new Response(JSON.stringify({ message: "Deleted" }), { status: 200 });
    } catch (error) {
        console.error("Error deleting API token", error);
        return new Response(JSON.stringify({ error: "Delete failed" }), { status: 500 });
    }
}
