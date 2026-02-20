// app/api/api-tokens/[id]/route.js
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import authOptions from "@/lib/authOptions";
import { logTokenDeleted } from "@/lib/audit";

export async function DELETE(request, { params }) {
    const session = await getServerSession(authOptions);
    if (!session) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }
    const { id } = await params;
    try {
        await prisma.apiToken.delete({ where: { id } });

        // Log token deletion
        await logTokenDeleted({
            tokenId: id,
            userId: session.user.id,
            req: request,
        });

        return new Response(JSON.stringify({ message: "Deleted" }), { status: 200 });
    } catch (error) {
        console.error("Error deleting API token", error);
        return new Response(JSON.stringify({ error: "Delete failed" }), { status: 500 });
    }
}
