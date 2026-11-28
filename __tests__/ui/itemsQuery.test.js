import { describe, it, expect } from "vitest";
import {
    DEFAULT_ITEMS_QUERY,
    PAGE_SIZES,
    defaultOrder,
    parseItemsQuery,
    serializeItemsQuery,
    toApiParams,
} from "../../lib/ui/itemsQuery.ts";

const full = {
    search: "web server",
    typeId: "t1",
    status: "MAINTENANCE",
    tagId: "tag9",
    sort: "name",
    order: "desc",
    page: 3,
    limit: 50,
};

describe("itemsQuery", () => {
    it("defaults", () => {
        expect(DEFAULT_ITEMS_QUERY).toEqual({
            search: "", typeId: "", status: "ALL", tagId: "", sort: "created", order: "desc", page: 1, limit: 10,
        });
        expect(PAGE_SIZES).toEqual([10, 25, 50, 100]);
        expect(serializeItemsQuery(DEFAULT_ITEMS_QUERY)).toBe("");
        expect(parseItemsQuery(new URLSearchParams(""))).toEqual(DEFAULT_ITEMS_QUERY);
    });

    it("round-trips a full query", () => {
        const s = serializeItemsQuery(full);
        expect(parseItemsQuery(new URLSearchParams(s))).toEqual(full);
    });

    it("omits default values when serializing", () => {
        expect(serializeItemsQuery({ ...DEFAULT_ITEMS_QUERY, page: 2 })).toBe("page=2");
    });

    it.each([
        ["page=0", "page"],
        ["page=abc", "page"],
        ["page=-3", "page"],
        ["limit=7", "limit"],
        ["limit=abc", "limit"],
        ["sort=x", "sort"],
        ["order=y", "order"],
        ["status=FOO", "status"],
    ])("falls back to default for %s", (qs, key) => {
        expect(parseItemsQuery(new URLSearchParams(qs))[key]).toBe(DEFAULT_ITEMS_QUERY[key]);
    });

    it("toApiParams always sends page and limit and omits status for ALL", () => {
        const p = toApiParams(DEFAULT_ITEMS_QUERY);
        expect(p.get("page")).toBe("1");
        expect(p.get("limit")).toBe("10");
        expect(p.has("status")).toBe(false);
        expect(p.has("search")).toBe(false);
        expect(p.has("typeId")).toBe(false);
        expect(p.has("tagId")).toBe(false);
    });

    it("toApiParams emits sort with explicit order and set filters", () => {
        const p = toApiParams({ ...full, sort: "name", order: "asc" });
        expect(p.get("search")).toBe("web server");
        expect(p.get("typeId")).toBe("t1");
        expect(p.get("status")).toBe("MAINTENANCE");
        expect(p.get("tagId")).toBe("tag9");
        expect(p.get("sort")).toBe("name");
        expect(p.get("order")).toBe("asc");
        expect(p.get("page")).toBe("3");
        expect(p.get("limit")).toBe("50");
    });

    it("toApiParams sends order explicitly with sort", () => {
        const p = toApiParams(DEFAULT_ITEMS_QUERY);
        expect(p.get("sort")).toBe("created");
        expect(p.get("order")).toBe("desc");
    });

    it("defaultOrder", () => {
        for (const s of ["created", "updated", "lastSeen"]) expect(defaultOrder(s)).toBe("desc");
        for (const s of ["name", "ip", "status", "type"]) expect(defaultOrder(s)).toBe("asc");
    });
});
