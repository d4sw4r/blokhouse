// GET  /api/v1/types   list item types with item counts
// POST /api/v1/types   create (409 if the name exists, case-insensitive)
import prisma from "@/lib/prisma";
import { route, json, readJson, validate, ApiError } from "@/lib/api/v1/http";
import { NamedCreate } from "@/lib/api/v1/schemas";

function serialize(t: { id: string; name: string; description: string | null; _count: { configurationItems: number } }) {
    return { id: t.id, name: t.name, description: t.description, itemCount: t._count.configurationItems };
}

export const GET = route("read", async () => {
    const types = await prisma.itemType.findMany({
        include: { _count: { select: { configurationItems: true } } },
        orderBy: { name: "asc" },
    });
    return json({ data: types.map(serialize) });
});

export const POST = route("write", async ({ req }) => {
    const input = validate(NamedCreate, await readJson(req));
    const exists = await prisma.itemType.findFirst({ where: { name: { equals: input.name, mode: "insensitive" } } });
    if (exists) throw new ApiError("conflict", `Type '${exists.name}' already exists`);
    const created = await prisma.itemType.create({
        data: { name: input.name, description: input.description ?? null },
        include: { _count: { select: { configurationItems: true } } },
    });
    return json({ data: serialize(created) }, 201);
});
