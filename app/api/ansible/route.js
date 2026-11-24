// app/api/ansible/route.js
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { buildAnsibleInventory } from "@/lib/ansible-inventory";

export async function GET(req) {
    const { response } = await requireAuth(req, "read");
    if (response) return response;

    const items = await prisma.configurationItem.findMany({
        include: { itemType: true },
    });

    const inventory = buildAnsibleInventory(items);

    return new Response(JSON.stringify(inventory, null, 2), {
        status: 200,
        headers: { "Content-Type": "application/json" },
    });
}
