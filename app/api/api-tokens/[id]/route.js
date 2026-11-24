// app/api/api-tokens/[id]/route.js
import prisma from "@/lib/prisma";
import { requireAuth, hasScope, jsonError } from "@/lib/auth";
import { logTokenDeleted } from "@/lib/audit";

export async function DELETE(request, { params }) {
    const { auth, response } = await requireAuth(request, "read");
    if (response) return response;
    if (auth.via !== "session") return jsonError(403, "Token management requires an interactive session");

    const { id } = await params;
    const token = await prisma.apiToken.findUnique({ where: { id }, select: { id: true, userId: true } });
    // Do not reveal whether someone else's token exists.
    if (!token || (token.userId !== auth.user.id && !hasScope(auth, "admin"))) {
        return jsonError(404, "Not found");
    }

    try {
        await prisma.apiToken.delete({ where: { id } });
        await logTokenDeleted({ tokenId: id, userId: auth.user.id, req: request });
        return new Response(JSON.stringify({ message: "Deleted" }), { status: 200 });
    } catch (error) {
        console.error("Error deleting API token", error);
        return jsonError(500, "Delete failed");
    }
}
