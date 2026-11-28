export type AssetStatus = "ACTIVE" | "DEPRECATED" | "MAINTENANCE";

export type ItemSort = "name" | "ip" | "status" | "type" | "lastSeen" | "updated" | "created";

export const PAGE_SIZES = [10, 25, 50, 100] as const;

export interface ItemsQuery {
    search: string;
    typeId: string;
    status: "ALL" | AssetStatus;
    tagId: string;
    sort: ItemSort;
    order: "asc" | "desc";
    page: number;
    limit: 10 | 25 | 50 | 100;
}

export const DEFAULT_ITEMS_QUERY: ItemsQuery = {
    search: "",
    typeId: "",
    status: "ALL",
    tagId: "",
    sort: "created",
    order: "desc",
    page: 1,
    limit: 10,
};

const SORTS: readonly ItemSort[] = ["name", "ip", "status", "type", "lastSeen", "updated", "created"];
const STATUSES: readonly AssetStatus[] = ["ACTIVE", "DEPRECATED", "MAINTENANCE"];

export function defaultOrder(sort: ItemSort): "asc" | "desc" {
    return sort === "created" || sort === "updated" || sort === "lastSeen" ? "desc" : "asc";
}

/** Parses URL params; any invalid value falls back to its default. */
export function parseItemsQuery(params: URLSearchParams): ItemsQuery {
    const d = DEFAULT_ITEMS_QUERY;
    const status = params.get("status") ?? "";
    const sort = params.get("sort") ?? "";
    const order = params.get("order") ?? "";
    const page = Number(params.get("page"));
    const limit = Number(params.get("limit"));
    return {
        search: params.get("search") ?? d.search,
        typeId: params.get("typeId") ?? d.typeId,
        status: (STATUSES as readonly string[]).includes(status) ? (status as AssetStatus) : d.status,
        tagId: params.get("tagId") ?? d.tagId,
        sort: (SORTS as readonly string[]).includes(sort) ? (sort as ItemSort) : d.sort,
        order: order === "asc" || order === "desc" ? order : d.order,
        page: Number.isInteger(page) && page >= 1 ? page : d.page,
        limit: (PAGE_SIZES as readonly number[]).includes(limit) ? (limit as ItemsQuery["limit"]) : d.limit,
    };
}

/** Serializes to a query string (no leading "?"), omitting default values. */
export function serializeItemsQuery(q: ItemsQuery): string {
    const d = DEFAULT_ITEMS_QUERY;
    const p = new URLSearchParams();
    if (q.search !== d.search) p.set("search", q.search);
    if (q.typeId !== d.typeId) p.set("typeId", q.typeId);
    if (q.status !== d.status) p.set("status", q.status);
    if (q.tagId !== d.tagId) p.set("tagId", q.tagId);
    if (q.sort !== d.sort) p.set("sort", q.sort);
    if (q.order !== d.order) p.set("order", q.order);
    if (q.page !== d.page) p.set("page", String(q.page));
    if (q.limit !== d.limit) p.set("limit", String(q.limit));
    return p.toString();
}

/** Params for GET /api/configuration-items. `order` is always sent with `sort`. */
export function toApiParams(q: ItemsQuery): URLSearchParams {
    const p = new URLSearchParams();
    p.set("page", String(q.page));
    p.set("limit", String(q.limit));
    if (q.search) p.set("search", q.search);
    if (q.typeId) p.set("typeId", q.typeId);
    if (q.status !== "ALL") p.set("status", q.status);
    if (q.tagId) p.set("tagId", q.tagId);
    if (q.sort) {
        p.set("sort", q.sort);
        p.set("order", q.order);
    }
    return p;
}
