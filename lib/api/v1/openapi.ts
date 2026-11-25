// lib/api/v1/openapi.ts
// OpenAPI 3.1 document for /api/v1, generated from the zod schemas.
import { OpenAPIRegistry, OpenApiGeneratorV31 } from "@asteasolutions/zod-to-openapi";
import { z } from "zod";
import * as S from "./schemas";

const registry = new OpenAPIRegistry();

registry.registerComponent("securitySchemes", "bearerAuth", {
    type: "http",
    scheme: "bearer",
    description: "API token created under Admin → API Tokens (`bh_…`).",
});

const security = [{ bearerAuth: [] }];
const err = (description: string) => ({
    description,
    content: { "application/json": { schema: S.ErrorBody } },
});
const common = {
    400: err("Validation failed or invalid JSON"),
    401: err("Missing or invalid credentials"),
    403: err("Missing scope"),
};
const body = (schema: z.ZodTypeAny) => ({ content: { "application/json": { schema } } });
const ok = (schema: z.ZodTypeAny, description = "OK") => ({ description, content: { "application/json": { schema } } });
const data = (schema: z.ZodTypeAny) => z.object({ data: schema });

const ItemId = z.object({ id: z.string().openapi({ description: "Item id" }) });
const ByName = z.object({ name: z.string().openapi({ description: "Item name (URL-encoded)", example: "web-01" }) });
const ByExternal = z.object({
    source: z.string().openapi({ example: "puppet" }),
    externalId: z.string().openapi({ example: "web-01.example.com" }),
});

const items = "/configuration-items";

registry.registerPath({
    method: "get", path: items, tags: ["Configuration Items"], security,
    summary: "List configuration items",
    request: { query: S.ItemQuery },
    responses: { 200: ok(S.ItemList), ...common },
});
registry.registerPath({
    method: "post", path: items, tags: ["Configuration Items"], security,
    summary: "Create a configuration item",
    description: "Requires the `write` scope. Types and tags are referenced by name and created if missing.",
    request: { body: body(S.ItemCreate) },
    responses: { 201: ok(data(S.Item), "Created"), ...common, 409: err("source/externalId already used") },
});
registry.registerPath({
    method: "get", path: `${items}/{id}`, tags: ["Configuration Items"], security,
    summary: "Get a configuration item",
    request: { params: ItemId },
    responses: { 200: ok(data(S.Item)), ...common, 404: err("Not found") },
});
registry.registerPath({
    method: "patch", path: `${items}/{id}`, tags: ["Configuration Items"], security,
    summary: "Update fields of a configuration item",
    request: { params: ItemId, body: body(S.ItemPatch) },
    responses: { 200: ok(data(S.Item)), ...common, 404: err("Not found") },
});
registry.registerPath({
    method: "delete", path: `${items}/{id}`, tags: ["Configuration Items"], security,
    summary: "Delete a configuration item",
    request: { params: ItemId },
    responses: { 204: { description: "Deleted" }, ...common, 404: err("Not found") },
});
registry.registerPath({
    method: "get", path: `${items}/by-name/{name}`, tags: ["Upsert"], security,
    summary: "Get an item by name",
    request: { params: ByName },
    responses: { 200: ok(data(S.Item)), ...common, 404: err("Not found"), 409: err("Name is ambiguous") },
});
registry.registerPath({
    method: "put", path: `${items}/by-name/{name}`, tags: ["Upsert"], security,
    summary: "Create or update an item by name",
    description:
        "Idempotent. Creates the item if no item has this name, otherwise updates only the fields in the body. " +
        "Sets `lastSeenAt` to now unless given. Returns 409 if several items share the name.",
    request: { params: ByName, body: body(S.ItemUpsert) },
    responses: {
        200: ok(S.UpsertResult, "Updated"),
        201: ok(S.UpsertResult, "Created"),
        ...common,
        409: err("Name is ambiguous"),
    },
});
registry.registerPath({
    method: "get", path: `${items}/by-external-id/{source}/{externalId}`, tags: ["Upsert"], security,
    summary: "Get an item by external identity",
    request: { params: ByExternal },
    responses: { 200: ok(data(S.Item)), ...common, 404: err("Not found") },
});
registry.registerPath({
    method: "put", path: `${items}/by-external-id/{source}/{externalId}`, tags: ["Upsert"], security,
    summary: "Create or update an item by external identity",
    description:
        "Idempotent. `source` + `externalId` are unique. Sets `lastSeenAt` to now unless given. " +
        "`name` is required when the item does not exist yet.",
    request: { params: ByExternal, body: body(S.ItemUpsert) },
    responses: { 200: ok(S.UpsertResult, "Updated"), 201: ok(S.UpsertResult, "Created"), ...common },
});
registry.registerPath({
    method: "post", path: `${items}/bulk-upsert`, tags: ["Upsert"], security,
    summary: `Upsert up to ${S.MAX_BULK} items atomically`,
    description: "All items are written in one transaction, or none if any item is invalid.",
    request: { body: body(S.BulkUpsertRequest) },
    responses: { 200: ok(S.BulkUpsertResponse), ...common, 409: err("An item name is ambiguous") },
});
registry.registerPath({
    method: "get", path: "/types", tags: ["Types & Tags"], security,
    summary: "List item types",
    responses: { 200: ok(data(z.array(S.ItemType))), ...common },
});
registry.registerPath({
    method: "post", path: "/types", tags: ["Types & Tags"], security,
    summary: "Create an item type",
    request: { body: body(S.NamedCreate) },
    responses: { 201: ok(data(S.ItemType), "Created"), ...common, 409: err("Exists") },
});
registry.registerPath({
    method: "get", path: "/tags", tags: ["Types & Tags"], security,
    summary: "List tags",
    responses: { 200: ok(data(z.array(S.Tag))), ...common },
});
registry.registerPath({
    method: "post", path: "/tags", tags: ["Types & Tags"], security,
    summary: "Create a tag",
    request: { body: body(S.TagCreate) },
    responses: { 201: ok(data(S.Tag), "Created"), ...common, 409: err("Exists") },
});

const HookId = z.object({ id: z.string().openapi({ description: "Webhook id" }) });
const webhookDescription =
    "Blokhouse POSTs JSON to the webhook URL when configuration items change (all write paths, including " +
    "the web UI and bulk operations). Requires the `admin` scope.\n\n" +
    "Body: `{ id, event, occurredAt, data: { item, previous, changes }, actor: { userId, via } }`. " +
    "Headers: `X-Blokhouse-Event`, `X-Blokhouse-Delivery`, `X-Blokhouse-Timestamp` and " +
    "`X-Blokhouse-Signature: sha256=<HMAC-SHA256(secret, \"<timestamp>.<body>\")>`. " +
    "Any 2xx response is a success; otherwise the delivery is retried up to 6 times over about 7 hours.";

registry.registerPath({
    method: "get", path: "/webhooks", tags: ["Webhooks"], security,
    summary: "List webhooks",
    description: webhookDescription,
    responses: { 200: ok(data(z.array(S.Webhook))), ...common },
});
registry.registerPath({
    method: "post", path: "/webhooks", tags: ["Webhooks"], security,
    summary: "Create a webhook",
    description: "The response contains the signing `secret`. It is not shown again.",
    request: { body: body(S.WebhookCreate) },
    responses: { 201: ok(data(S.Webhook), "Created"), ...common },
});
registry.registerPath({
    method: "get", path: "/webhooks/{id}", tags: ["Webhooks"], security,
    summary: "Get a webhook",
    request: { params: HookId },
    responses: { 200: ok(data(S.Webhook)), ...common, 404: err("Not found") },
});
registry.registerPath({
    method: "patch", path: "/webhooks/{id}", tags: ["Webhooks"], security,
    summary: "Update a webhook",
    description: "With `rotateSecret: true` a new secret is generated and returned once.",
    request: { params: HookId, body: body(S.WebhookPatch) },
    responses: { 200: ok(data(S.Webhook)), ...common, 404: err("Not found") },
});
registry.registerPath({
    method: "delete", path: "/webhooks/{id}", tags: ["Webhooks"], security,
    summary: "Delete a webhook and its delivery log",
    request: { params: HookId },
    responses: { 204: { description: "Deleted" }, ...common, 404: err("Not found") },
});
registry.registerPath({
    method: "post", path: "/webhooks/{id}/ping", tags: ["Webhooks"], security,
    summary: "Send a test event",
    description: "Sends a `ping` event right away and returns the delivery, so you can see whether the receiver works.",
    request: { params: HookId },
    responses: { 200: ok(data(S.WebhookDelivery)), ...common, 404: err("Not found") },
});
registry.registerPath({
    method: "get", path: "/webhooks/{id}/deliveries", tags: ["Webhooks"], security,
    summary: "Delivery log",
    description: "Newest first, with payloads. Successful deliveries are kept 14 days, failed ones 30 days.",
    request: {
        params: HookId,
        query: z.object({
            status: z.enum(["pending", "success", "failed"]).optional(),
            page: z.coerce.number().int().min(1).optional(),
            per_page: z.coerce.number().int().min(1).max(500).optional(),
        }),
    },
    responses: { 200: ok(z.object({ data: z.array(S.WebhookDelivery), meta: S.PageMeta })), ...common, 404: err("Not found") },
});
registry.registerPath({
    method: "post", path: "/webhooks/{id}/deliveries/{deliveryId}/redeliver", tags: ["Webhooks"], security,
    summary: "Send a delivery again",
    request: { params: HookId.extend({ deliveryId: z.string() }) },
    responses: { 200: ok(data(S.WebhookDelivery)), ...common, 404: err("Not found") },
});

let cached: ReturnType<OpenApiGeneratorV31["generateDocument"]> | null = null;

export function openApiDocument(version: string) {
    if (!cached) {
        cached = new OpenApiGeneratorV31(registry.definitions).generateDocument({
            openapi: "3.1.0",
            info: {
                title: "Blokhouse API",
                version,
                description:
                    "Automation-first CMDB API. Authenticate with `Authorization: Bearer <token>`. " +
                    "Errors always look like `{ \"error\": { \"code\", \"message\", \"details\" } }`.",
                license: { name: "MIT", url: "https://github.com/d4sw4r/blokhouse/blob/main/LICENSE" },
            },
            servers: [{ url: "/api/v1" }],
        });
    }
    return cached;
}
