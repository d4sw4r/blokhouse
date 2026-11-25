// lib/api/v1/schemas.ts
// Request/response schemas for /api/v1. They validate input AND generate the
// OpenAPI document (lib/api/v1/openapi.ts), so docs cannot drift from code.
import { z } from "zod";
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import { isIP } from "node:net";

extendZodWithOpenApi(z);

export const STATUSES = ["ACTIVE", "MAINTENANCE", "DEPRECATED"] as const;
export const Status = z.enum(STATUSES).openapi("Status");

const MAC_RE = /^(?:[0-9A-Fa-f]{2}([:-]))(?:[0-9A-Fa-f]{2}\1){4}[0-9A-Fa-f]{2}$|^(?:[0-9A-Fa-f]{4}\.){2}[0-9A-Fa-f]{4}$/;

const trimmed = (max: number) => z.string().trim().min(1).max(max);
const nullableText = (max: number) => z.string().trim().max(max).nullable();

export const Ip = z
    .string()
    .trim()
    .refine((v) => isIP(v) !== 0, { message: "Must be a valid IPv4 or IPv6 address" })
    .openapi({ example: "10.0.0.15" });

export const Mac = z
    .string()
    .trim()
    .regex(MAC_RE, "Must be a MAC address like 00:11:22:33:44:55")
    .openapi({ example: "00:11:22:33:44:55" });

/** Custom field values by field name. */
export const CustomFieldValues = z
    .record(z.string().min(1), z.union([z.string(), z.number(), z.boolean(), z.null()]))
    .openapi("CustomFieldValues", {
        description:
            "Values keyed by custom field name. The field must exist for the item's type (or globally). " +
            "`null` removes a value.",
        example: { os: "Debian 12", rack_unit: 14 },
    });

/** Writable item fields. Used for create, PATCH and upsert. */
const itemFields = {
    name: trimmed(255).openapi({ example: "web-01" }),
    description: nullableText(5000).optional(),
    ip: Ip.nullable().optional(),
    mac: Mac.nullable().optional(),
    status: Status.optional(),
    type: trimmed(100)
        .nullable()
        .optional()
        .openapi({ description: "Item type by name. Created if it does not exist.", example: "Server" }),
    tags: z
        .array(trimmed(100))
        .max(100)
        .optional()
        .openapi({ description: "Tag names. Replaces all tags. Missing tags are created.", example: ["prod", "web"] }),
    customFields: CustomFieldValues.optional(),
    source: trimmed(100)
        .nullable()
        .optional()
        .openapi({ description: "System that owns this item, e.g. `ansible`, `puppet`", example: "puppet" }),
    externalId: trimmed(255)
        .nullable()
        .optional()
        .openapi({ description: "ID of the item in `source`, e.g. the Puppet certname", example: "web-01.example.com" }),
    lastSeenAt: z.coerce
        .date()
        .nullable()
        .optional()
        .openapi({ type: "string", format: "date-time", description: "When automation last saw this item" }),
};

export const ItemCreate = z
    .object(itemFields)
    .strict()
    .refine((v) => (v.externalId == null) === (v.source == null), {
        message: "source and externalId must be set together",
        path: ["externalId"],
    })
    .openapi("ItemCreate");

export const ItemPatch = z
    .object({ ...itemFields, name: itemFields.name.optional() })
    .strict()
    .openapi("ItemPatch", { description: "Only the fields present are changed." });

/** Body for PUT /by-name/{name} and /by-external-id/{source}/{externalId}. */
export const ItemUpsert = z
    .object({ ...itemFields, name: itemFields.name.optional() })
    .strict()
    .openapi("ItemUpsert", {
        description:
            "Creates the item if it does not exist, otherwise updates only the fields present. " +
            "Identity fields from the URL take precedence.",
    });

export const BulkUpsertItem = z
    .object({
        ...itemFields,
        name: itemFields.name.optional(),
        match: z
            .enum(["name", "externalId"])
            .default("name")
            .openapi({ description: "How to find an existing item: by `name`, or by `source` + `externalId`." }),
    })
    .strict()
    .superRefine((v, ctx) => {
        if (v.match === "name" && !v.name) {
            ctx.addIssue({ code: "custom", message: "name is required when match is 'name'", path: ["name"] });
        }
        if (v.match === "externalId" && (!v.source || !v.externalId)) {
            ctx.addIssue({
                code: "custom",
                message: "source and externalId are required when match is 'externalId'",
                path: ["externalId"],
            });
        }
    })
    .openapi("BulkUpsertItem");

export const MAX_BULK = 1000;

export const BulkUpsertRequest = z
    .object({ items: z.array(BulkUpsertItem).min(1).max(MAX_BULK) })
    .strict()
    .openapi("BulkUpsertRequest");

export const Item = z
    .object({
        id: z.string(),
        name: z.string(),
        description: z.string().nullable(),
        ip: z.string().nullable(),
        mac: z.string().nullable(),
        status: Status,
        type: z.string().nullable(),
        tags: z.array(z.string()),
        customFields: z.record(z.string(), z.string()),
        source: z.string().nullable(),
        externalId: z.string().nullable(),
        lastSeenAt: z.string().nullable().openapi({ format: "date-time" }),
        createdAt: z.string().openapi({ format: "date-time" }),
        updatedAt: z.string().openapi({ format: "date-time" }),
    })
    .openapi("Item");

export const PageMeta = z
    .object({ page: z.number(), per_page: z.number(), total: z.number(), total_pages: z.number() })
    .openapi("PageMeta");

export const ItemList = z.object({ data: z.array(Item), meta: PageMeta }).openapi("ItemList");

// "unchanged": the item already matched; only lastSeenAt was refreshed and no audit entry was written.
const UpsertOutcome = z.enum(["created", "updated", "unchanged"]);

export const UpsertResult = z
    .object({ result: UpsertOutcome, data: Item })
    .openapi("UpsertResult");

export const BulkUpsertResponse = z
    .object({
        data: z.array(z.object({ index: z.number(), result: UpsertOutcome, id: z.string() })),
        meta: z.object({ created: z.number(), updated: z.number(), unchanged: z.number() }),
    })
    .openapi("BulkUpsertResponse");

export const ItemQuery = z.object({
    q: z.string().optional().openapi({ description: "Search in name, description, IP, MAC (case-insensitive)" }),
    status: Status.optional(),
    type: z.string().optional().openapi({ description: "Type name (case-insensitive)" }),
    tag: z.string().optional().openapi({ description: "Tag name" }),
    source: z.string().optional(),
    page: z.coerce.number().int().min(1).optional(),
    per_page: z.coerce.number().int().min(1).max(500).optional(),
});

export const NamedCreate = z
    .object({
        name: trimmed(100),
        description: nullableText(1000).optional(),
    })
    .strict()
    .openapi("TypeCreate");

export const TagCreate = z
    .object({
        name: trimmed(100),
        description: nullableText(1000).optional(),
        color: z
            .string()
            .regex(/^#[0-9a-fA-F]{6}$/, "Must be a hex color like #3b82f6")
            .nullable()
            .optional(),
    })
    .strict()
    .openapi("TagCreate");

export const ItemType = z
    .object({ id: z.string(), name: z.string(), description: z.string().nullable(), itemCount: z.number() })
    .openapi("ItemType");

export const Tag = z
    .object({
        id: z.string(),
        name: z.string(),
        description: z.string().nullable(),
        color: z.string().nullable(),
        itemCount: z.number(),
    })
    .openapi("Tag");

export const ErrorBody = z
    .object({
        error: z.object({
            code: z.enum([
                "unauthorized",
                "forbidden",
                "not_found",
                "validation_failed",
                "invalid_json",
                "conflict",
                "payload_too_large",
                "internal_error",
            ]),
            message: z.string(),
            details: z.unknown().optional(),
        }),
    })
    .openapi("Error", {
        example: {
            error: {
                code: "validation_failed",
                message: "Request body is invalid",
                details: [{ path: "ip", message: "Must be a valid IPv4 or IPv6 address" }],
            },
        },
    });

export type ItemInput = z.infer<typeof ItemPatch>;
