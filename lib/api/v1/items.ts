// lib/api/v1/items.ts
// Configuration item logic for /api/v1: name-based references (type, tags,
// custom fields), create/update/upsert inside transactions, serialization.
import prisma from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit";
import { parseOptions } from "@/lib/custom-field-options";
import { ApiError } from "./http";
import type { ItemInput } from "./schemas";

type Tx = Omit<typeof prisma, "$connect" | "$disconnect" | "$on" | "$transaction" | "$extends">;

export const ITEM_INCLUDE = {
    itemType: true,
    tags: { orderBy: { name: "asc" as const } },
    customFieldValues: { include: { customField: true } },
};

type LoadedItem = {
    id: string;
    name: string;
    description: string | null;
    ip: string | null;
    mac: string | null;
    status: string;
    source: string | null;
    externalId: string | null;
    lastSeenAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    itemTypeId: string | null;
    itemType: { name: string } | null;
    tags: { name: string }[];
    customFieldValues: { value: string; customField: { name: string } }[];
};

export function serializeItem(item: LoadedItem) {
    return {
        id: item.id,
        name: item.name,
        description: item.description,
        ip: item.ip,
        mac: item.mac,
        status: item.status,
        type: item.itemType?.name ?? null,
        tags: item.tags.map((t) => t.name),
        customFields: Object.fromEntries(item.customFieldValues.map((v) => [v.customField.name, v.value])),
        source: item.source,
        externalId: item.externalId,
        lastSeenAt: item.lastSeenAt ? item.lastSeenAt.toISOString() : null,
        createdAt: item.createdAt.toISOString(),
        updatedAt: item.updatedAt.toISOString(),
    };
}

/** Audit snapshot without relations. */
function snapshot(item: LoadedItem | null) {
    if (!item) return null;
    const s = serializeItem(item);
    return { ...s, createdAt: undefined, updatedAt: undefined };
}

/** True if two versions differ at most in timestamps (lastSeenAt, updatedAt). */
export function sameContent(a: LoadedItem, b: LoadedItem): boolean {
    const content = (item: LoadedItem) => {
        const s = serializeItem(item);
        return JSON.stringify({
            ...s,
            lastSeenAt: undefined,
            updatedAt: undefined,
            createdAt: undefined,
            customFields: Object.entries(s.customFields).sort(([x], [y]) => x.localeCompare(y)),
        });
    };
    return content(a) === content(b);
}

export type UpsertOutcome = "created" | "updated" | "unchanged";

// ---------------------------------------------------------------------------
// Name-based references
// ---------------------------------------------------------------------------

export async function resolveTypeId(tx: Tx, name: string | null | undefined): Promise<string | null | undefined> {
    if (name === undefined) return undefined;
    if (name === null) return null;
    const existing = await tx.itemType.findFirst({
        where: { name: { equals: name, mode: "insensitive" } },
        select: { id: true },
        orderBy: { name: "asc" },
    });
    if (existing) return existing.id;
    const created = await tx.itemType.create({ data: { name }, select: { id: true } });
    return created.id;
}

export async function resolveTagIds(tx: Tx, names: string[] | undefined): Promise<string[] | undefined> {
    if (names === undefined) return undefined;
    // Dedupe case-insensitively, keeping the first spelling.
    const unique: string[] = [];
    const seen = new Set<string>();
    for (const n of names) {
        if (!seen.has(n.toLowerCase())) {
            seen.add(n.toLowerCase());
            unique.push(n);
        }
    }
    const ids: string[] = [];
    for (const name of unique) {
        const existing = await tx.tag.findFirst({
            where: { name: { equals: name, mode: "insensitive" } },
            select: { id: true },
        });
        if (existing) {
            ids.push(existing.id);
        } else {
            const created = await tx.tag.upsert({ where: { name }, update: {}, create: { name }, select: { id: true } });
            ids.push(created.id);
        }
    }
    return ids;
}

const URL_RE = /^https?:\/\/\S+$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Convert a custom field value to its stored string form, or explain why it is invalid. */
export function normalizeCustomValue(type: string, value: string | number | boolean): { value?: string; error?: string } {
    const str = String(value).trim();
    switch (type) {
        case "NUMBER":
            return str !== "" && Number.isFinite(Number(str)) ? { value: String(Number(str)) } : { error: "must be a number" };
        case "BOOLEAN":
            if (value === true || /^(true|1|yes)$/i.test(str)) return { value: "true" };
            if (value === false || /^(false|0|no)$/i.test(str)) return { value: "false" };
            return { error: "must be a boolean" };
        case "DATE": {
            const d = new Date(str);
            return str && !Number.isNaN(d.getTime()) ? { value: d.toISOString().slice(0, 10) } : { error: "must be a date (YYYY-MM-DD)" };
        }
        case "URL":
            return URL_RE.test(str) ? { value: str } : { error: "must be an http(s) URL" };
        case "EMAIL":
            return EMAIL_RE.test(str) ? { value: str } : { error: "must be an email address" };
        default:
            return { value: String(value) };
    }
}

async function applyCustomFields(
    tx: Tx,
    itemId: string,
    itemTypeId: string | null,
    values: Record<string, string | number | boolean | null> | undefined,
    pathPrefix: string
) {
    if (!values || Object.keys(values).length === 0) return;
    const names = Object.keys(values);
    const fields = await tx.customField.findMany({
        where: { name: { in: names }, OR: [{ itemTypeId: null }, ...(itemTypeId ? [{ itemTypeId }] : [])] },
        select: { id: true, name: true, type: true, itemTypeId: true, options: true },
    });
    // A type-specific field wins over a global one with the same name.
    const byName = new Map<string, (typeof fields)[number]>();
    for (const f of fields) {
        if (!byName.has(f.name) || f.itemTypeId) byName.set(f.name, f);
    }

    const issues: { path: string; message: string }[] = [];
    const writes: { fieldId: string; value: string | null }[] = [];
    for (const name of names) {
        const field = byName.get(name);
        const raw = values[name];
        if (!field) {
            issues.push({ path: `${pathPrefix}customFields.${name}`, message: "unknown custom field for this item type" });
            continue;
        }
        if (raw === null) {
            writes.push({ fieldId: field.id, value: null });
            continue;
        }
        const res = normalizeCustomValue(field.type, raw);
        const options = parseOptions(field.options);
        if (res.error) {
            issues.push({ path: `${pathPrefix}customFields.${name}`, message: res.error });
        } else if (options.length > 0 && !options.includes(res.value!)) {
            issues.push({ path: `${pathPrefix}customFields.${name}`, message: `must be one of: ${options.join(", ")}` });
        } else {
            writes.push({ fieldId: field.id, value: res.value! });
        }
    }
    if (issues.length) throw new ApiError("validation_failed", "Invalid custom field values", issues);

    for (const w of writes) {
        if (w.value === null) {
            await tx.customFieldValue.deleteMany({ where: { customFieldId: w.fieldId, configurationItemId: itemId } });
        } else {
            await tx.customFieldValue.upsert({
                where: { customFieldId_configurationItemId: { customFieldId: w.fieldId, configurationItemId: itemId } },
                update: { value: w.value },
                create: { customFieldId: w.fieldId, configurationItemId: itemId, value: w.value },
            });
        }
    }
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

type WriteOptions = { userId: string; pathPrefix?: string };

/** Create an item inside `tx`. `input.name` must be set. Returns the new id. */
export async function createItemTx(tx: Tx, input: ItemInput, opts: WriteOptions): Promise<string> {
    if (!input.name) {
        throw new ApiError("validation_failed", "name is required", [{ path: `${opts.pathPrefix ?? ""}name`, message: "Required" }]);
    }
    const itemTypeId = (await resolveTypeId(tx, input.type)) ?? null;
    const tagIds = await resolveTagIds(tx, input.tags);
    const created = await tx.configurationItem.create({
        data: {
            name: input.name,
            description: input.description ?? null,
            ip: input.ip ?? null,
            mac: input.mac ?? null,
            status: input.status ?? "ACTIVE",
            source: input.source ?? null,
            externalId: input.externalId ?? null,
            lastSeenAt: input.lastSeenAt ?? null,
            itemTypeId,
            userId: opts.userId,
            ...(tagIds && { tags: { connect: tagIds.map((id) => ({ id })) } }),
        },
        select: { id: true },
    });
    await applyCustomFields(tx, created.id, itemTypeId, input.customFields, opts.pathPrefix ?? "");
    return created.id;
}

/** Update only the fields present in `input`. */
export async function updateItemTx(
    tx: Tx,
    existing: { id: string; itemTypeId: string | null },
    input: ItemInput,
    opts: WriteOptions
): Promise<void> {
    const itemTypeId = await resolveTypeId(tx, input.type);
    const tagIds = await resolveTagIds(tx, input.tags);
    const data: Record<string, unknown> = {};
    for (const key of ["name", "description", "ip", "mac", "status", "source", "externalId", "lastSeenAt"] as const) {
        if (input[key] !== undefined) data[key] = input[key];
    }
    if (itemTypeId !== undefined) data.itemTypeId = itemTypeId;
    if (tagIds !== undefined) data.tags = { set: tagIds.map((id) => ({ id })) };
    if (Object.keys(data).length) {
        await tx.configurationItem.update({ where: { id: existing.id }, data });
    }
    const effectiveType = itemTypeId !== undefined ? itemTypeId : existing.itemTypeId;
    await applyCustomFields(tx, existing.id, effectiveType, input.customFields, opts.pathPrefix ?? "");
}

export type Identity = { by: "name"; name: string } | { by: "externalId"; source: string; externalId: string };

/** Find the item an upsert refers to. Throws 409 if a name is ambiguous. */
export async function findByIdentity(tx: Tx, identity: Identity) {
    if (identity.by === "externalId") {
        return tx.configurationItem.findUnique({
            where: { source_externalId: { source: identity.source, externalId: identity.externalId } },
            select: { id: true, itemTypeId: true },
        });
    }
    const matches = await tx.configurationItem.findMany({
        where: { name: identity.name },
        select: { id: true, itemTypeId: true },
        take: 2,
    });
    if (matches.length > 1) {
        throw new ApiError(
            "conflict",
            `More than one item is named '${identity.name}'. Use by-external-id or the item id instead.`
        );
    }
    return matches[0] ?? null;
}

/** Create or update by identity. Upserts mark the item as seen now unless lastSeenAt is given. */
export async function upsertItemTx(tx: Tx, identity: Identity, input: ItemInput, opts: WriteOptions) {
    const merged: ItemInput = {
        ...input,
        ...(identity.by === "name" ? { name: identity.name } : { source: identity.source, externalId: identity.externalId }),
        lastSeenAt: input.lastSeenAt !== undefined ? input.lastSeenAt : new Date(),
    };
    const existing = await findByIdentity(tx, identity);
    if (existing) {
        const load = () => tx.configurationItem.findUnique({ where: { id: existing.id }, include: ITEM_INCLUDE });
        const before = (await load()) as LoadedItem;
        await updateItemTx(tx, existing, merged, opts);
        const after = (await load()) as LoadedItem;
        // Reporting the same state again only refreshes lastSeenAt; callers such as
        // Ansible use "unchanged" to report changed=false, and no audit row is written.
        const result = sameContent(before, after) ? ("unchanged" as const) : ("updated" as const);
        return { id: existing.id, result, before: serializeItem(before), after: serializeItem(after) };
    }
    if (!merged.name) {
        throw new ApiError("validation_failed", "name is required to create a new item", [
            { path: `${opts.pathPrefix ?? ""}name`, message: "Required when the item does not exist yet" },
        ]);
    }
    const id = await createItemTx(tx, merged, opts);
    return { id, result: "created" as const, before: null, after: null };
}

export const TX_OPTIONS = { timeout: 60_000, maxWait: 10_000 };

export async function loadItem(id: string) {
    const item = await prisma.configurationItem.findUnique({ where: { id }, include: ITEM_INCLUDE });
    return item as LoadedItem | null;
}

export async function audit(
    action: "CREATE" | "UPDATE" | "DELETE",
    before: LoadedItem | null,
    after: LoadedItem | null,
    userId: string,
    req: Request,
    via: string
) {
    const item = after ?? before!;
    await createAuditLog({
        action,
        entityType: "ConfigurationItem",
        entityId: item.id,
        userId,
        description: `${action === "CREATE" ? "Created" : action === "UPDATE" ? "Updated" : "Deleted"} configuration item "${item.name}" via API v1 (${via})`,
        oldValues: snapshot(before) ?? undefined,
        newValues: snapshot(after) ?? undefined,
        req,
    });
}
