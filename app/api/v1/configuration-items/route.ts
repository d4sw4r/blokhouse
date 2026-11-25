// GET  /api/v1/configuration-items   list with filters + pagination
// POST /api/v1/configuration-items   create
import prisma from "@/lib/prisma";
import { route, json, readJson, validate, pagination, pageMeta } from "@/lib/api/v1/http";
import { ItemCreate, ItemQuery } from "@/lib/api/v1/schemas";
import { ITEM_INCLUDE, TX_OPTIONS, createItemTx, loadItem, serializeItem, audit } from "@/lib/api/v1/items";
import { emitItemEvent } from "@/lib/webhooks";

export const GET = route("read", async ({ req }) => {
    const url = new URL(req.url);
    const query = validate(ItemQuery, Object.fromEntries(url.searchParams), "Query");
    const { page, perPage, skip, take } = pagination(url);

    const where: Record<string, unknown> = {};
    if (query.q) {
        where.OR = ["name", "description", "ip", "mac"].map((f) => ({
            [f]: { contains: query.q, mode: "insensitive" },
        }));
    }
    if (query.status) where.status = query.status;
    if (query.source) where.source = query.source;
    if (query.type) where.itemType = { name: { equals: query.type, mode: "insensitive" } };
    if (query.tag) where.tags = { some: { name: { equals: query.tag, mode: "insensitive" } } };

    const [total, items] = await Promise.all([
        prisma.configurationItem.count({ where }),
        prisma.configurationItem.findMany({
            where,
            include: ITEM_INCLUDE,
            orderBy: [{ name: "asc" }, { id: "asc" }],
            skip,
            take,
        }),
    ]);

    return json({ data: items.map(serializeItem), meta: pageMeta(page, perPage, total) });
});

export const POST = route("write", async ({ req, auth }) => {
    const input = validate(ItemCreate, await readJson(req));
    const id = await prisma.$transaction((tx) => createItemTx(tx, input, { userId: auth.user.id }), TX_OPTIONS);
    const item = (await loadItem(id))!;
    await audit("CREATE", null, item, auth.user.id, req, auth.via);
    await emitItemEvent("item.created", { item: serializeItem(item), actor: { userId: auth.user.id, via: auth.via } });
    return json({ data: serializeItem(item) }, 201, { Location: `/api/v1/configuration-items/${id}` });
});
