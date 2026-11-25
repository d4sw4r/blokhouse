// GET  /api/v1/tags   list tags with item counts
// POST /api/v1/tags   create (409 if the name exists, case-insensitive)
import prisma from "@/lib/prisma";
import { route, json, readJson, validate, ApiError } from "@/lib/api/v1/http";
import { TagCreate } from "@/lib/api/v1/schemas";

function serialize(t: {
    id: string;
    name: string;
    description: string | null;
    color: string | null;
    _count: { configurationItems: number };
}) {
    return { id: t.id, name: t.name, description: t.description, color: t.color, itemCount: t._count.configurationItems };
}

export const GET = route("read", async () => {
    const tags = await prisma.tag.findMany({
        include: { _count: { select: { configurationItems: true } } },
        orderBy: { name: "asc" },
    });
    return json({ data: tags.map(serialize) });
});

export const POST = route("write", async ({ req }) => {
    const input = validate(TagCreate, await readJson(req));
    const exists = await prisma.tag.findFirst({ where: { name: { equals: input.name, mode: "insensitive" } } });
    if (exists) throw new ApiError("conflict", `Tag '${exists.name}' already exists`);
    const created = await prisma.tag.create({
        data: { name: input.name, description: input.description ?? null, color: input.color ?? null },
        include: { _count: { select: { configurationItems: true } } },
    });
    return json({ data: serialize(created) }, 201);
});
