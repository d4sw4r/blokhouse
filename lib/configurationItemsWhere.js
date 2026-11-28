/**
 * Prisma `where` for listing configuration items, shared by GET /api/configuration-items and
 * its export so both filter the same way. Empty values add no condition.
 * @param {{ search?: string, typeId?: string, status?: string, tagId?: string }} filters
 * @returns {Record<string, unknown>}
 */
export function buildConfigurationItemsWhere({ search = "", typeId = "", status = "", tagId = "" } = {}) {
    const where = {};
    // Search across name, description, ip, and mac fields
    if (search) {
        where.OR = [
            { name: { contains: search, mode: "insensitive" } },
            { description: { contains: search, mode: "insensitive" } },
            { ip: { contains: search, mode: "insensitive" } },
            { mac: { contains: search, mode: "insensitive" } },
        ];
    }
    if (typeId) where.itemTypeId = typeId;
    if (status) where.status = status;
    if (tagId) where.tags = { some: { id: tagId } };
    return where;
}
