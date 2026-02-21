import { describe, it, expect } from "vitest";
import { buildAnsibleInventory } from "../lib/ansible-inventory.js";

// ── Helpers ─────────────────────────────────────────────────────────────────

function makeItem(overrides = {}) {
    return {
        id: "id-1",
        name: "host-01",
        ip: "192.168.1.1",
        mac: "00:11:22:33:44:55",
        description: "Test host",
        status: "ACTIVE",
        itemType: null,
        ...overrides,
    };
}

// ── buildAnsibleInventory ────────────────────────────────────────────────────

describe("buildAnsibleInventory", () => {
    it("returns empty inventory when given an empty list", () => {
        const result = buildAnsibleInventory([]);
        expect(result.all.hosts).toEqual([]);
        expect(result._meta.hostvars).toEqual({});
    });

    it("includes only hosts that have an IP address in all.hosts", () => {
        const items = [
            makeItem({ name: "with-ip", ip: "10.0.0.1" }),
            makeItem({ name: "no-ip", ip: null }),
            makeItem({ name: "empty-ip", ip: "" }),
        ];
        const result = buildAnsibleInventory(items);
        expect(result.all.hosts).toEqual(["with-ip"]);
    });

    it("populates hostvars with ansible_host for items with an IP", () => {
        const item = makeItem({ name: "srv", ip: "10.1.2.3" });
        const result = buildAnsibleInventory([item]);
        expect(result._meta.hostvars["srv"]).toMatchObject({
            ansible_host: "10.1.2.3",
        });
    });

    it("includes mac in hostvars when present", () => {
        const item = makeItem({ name: "srv", ip: "10.0.0.1", mac: "AA:BB:CC:DD:EE:FF" });
        const result = buildAnsibleInventory([item]);
        expect(result._meta.hostvars["srv"].mac).toBe("AA:BB:CC:DD:EE:FF");
    });

    it("omits mac from hostvars when absent", () => {
        const item = makeItem({ name: "srv", ip: "10.0.0.1", mac: null });
        const result = buildAnsibleInventory([item]);
        expect(result._meta.hostvars["srv"]).not.toHaveProperty("mac");
    });

    it("includes description in hostvars when present", () => {
        const item = makeItem({ name: "srv", ip: "10.0.0.1", description: "My server" });
        const result = buildAnsibleInventory([item]);
        expect(result._meta.hostvars["srv"].description).toBe("My server");
    });

    it("omits description from hostvars when absent", () => {
        const item = makeItem({ name: "srv", ip: "10.0.0.1", description: null });
        const result = buildAnsibleInventory([item]);
        expect(result._meta.hostvars["srv"]).not.toHaveProperty("description");
    });

    it("always includes status in hostvars", () => {
        const item = makeItem({ name: "srv", ip: "10.0.0.1", status: "MAINTENANCE" });
        const result = buildAnsibleInventory([item]);
        expect(result._meta.hostvars["srv"].status).toBe("MAINTENANCE");
    });

    it("groups items by itemType name", () => {
        const items = [
            makeItem({ name: "web-01", ip: "10.0.0.1", itemType: { name: "webserver" } }),
            makeItem({ name: "web-02", ip: "10.0.0.2", itemType: { name: "webserver" } }),
            makeItem({ name: "db-01", ip: "10.0.0.3", itemType: { name: "database" } }),
        ];
        const result = buildAnsibleInventory(items);
        expect(result.webserver.hosts).toEqual(["web-01", "web-02"]);
        expect(result.database.hosts).toEqual(["db-01"]);
    });

    it("puts items without itemType into the 'ungrouped' group", () => {
        const item = makeItem({ name: "lonely", ip: "10.0.0.9", itemType: null });
        const result = buildAnsibleInventory([item]);
        expect(result.ungrouped.hosts).toContain("lonely");
    });

    it("does not add items without IP to any group", () => {
        const item = makeItem({ name: "no-ip", ip: null, itemType: { name: "webserver" } });
        const result = buildAnsibleInventory([item]);
        expect(result.webserver).toBeUndefined();
    });

    it("initialises each group's vars as an empty object", () => {
        const item = makeItem({ name: "srv", ip: "10.0.0.1", itemType: { name: "db" } });
        const result = buildAnsibleInventory([item]);
        expect(result.db.vars).toEqual({});
    });

    it("always sets all.vars to an empty object", () => {
        const result = buildAnsibleInventory([makeItem()]);
        expect(result.all.vars).toEqual({});
    });

    it("handles a large mixed set correctly", () => {
        const items = [
            makeItem({ name: "a", ip: "1.2.3.4", itemType: { name: "type1" } }),
            makeItem({ name: "b", ip: "1.2.3.5", itemType: { name: "type1" } }),
            makeItem({ name: "c", ip: "1.2.3.6", itemType: { name: "type2" } }),
            makeItem({ name: "d", ip: null }),           // no IP
            makeItem({ name: "e", ip: "1.2.3.7", itemType: null }),  // ungrouped
        ];
        const result = buildAnsibleInventory(items);
        expect(result.all.hosts).toHaveLength(4);
        expect(result.type1.hosts).toHaveLength(2);
        expect(result.type2.hosts).toHaveLength(1);
        expect(result.ungrouped.hosts).toContain("e");
        expect(Object.keys(result._meta.hostvars)).toHaveLength(4);
    });
});
