import { describe, it, expect } from "vitest";
import {
    toChefIdentifier,
    buildChefNode,
    buildDataBagItem,
} from "../lib/chef-node.js";

// ── toChefIdentifier ────────────────────────────────────────────────────────

describe("toChefIdentifier", () => {
    it("lowercases input", () => {
        expect(toChefIdentifier("Database")).toBe("database");
    });

    it("replaces spaces with underscores", () => {
        expect(toChefIdentifier("web server")).toBe("web_server");
    });

    it("replaces hyphens and special chars with underscores", () => {
        expect(toChefIdentifier("DB-Primary (01)")).toBe("db_primary_01");
    });

    it("strips leading/trailing underscores", () => {
        expect(toChefIdentifier(" web ")).toBe("web");
    });
});

// ── buildChefNode ───────────────────────────────────────────────────────────

describe("buildChefNode", () => {
    const baseItem = {
        id: "item_abc",
        name: "db-01",
    };

    it("returns required Chef::Node top-level keys", () => {
        const node = buildChefNode(baseItem);
        expect(node).toHaveProperty("name", "db-01");
        expect(node).toHaveProperty("chef_type", "node");
        expect(node).toHaveProperty("json_class", "Chef::Node");
        expect(node).toHaveProperty("chef_environment");
        expect(node).toHaveProperty("run_list");
        expect(node).toHaveProperty("automatic");
        expect(node).toHaveProperty("normal");
        expect(node).toHaveProperty("default");
        expect(node).toHaveProperty("override");
    });

    it("uses _default environment when no itemType", () => {
        const node = buildChefNode(baseItem);
        expect(node.chef_environment).toBe("_default");
        expect(node.run_list).toEqual(["role[base]"]);
    });

    it("uses itemType as environment and role", () => {
        const item = { ...baseItem, itemType: { name: "WebServer" } };
        const node = buildChefNode(item);
        expect(node.chef_environment).toBe("webserver");
        expect(node.run_list).toEqual(["role[webserver]"]);
    });

    it("sets hostname and fqdn from item name in automatic attrs", () => {
        const node = buildChefNode(baseItem);
        expect(node.automatic.hostname).toBe("db-01");
        expect(node.automatic.fqdn).toBe("db-01");
    });

    it("includes ipaddress in automatic attrs when ip is set", () => {
        const item = { ...baseItem, ip: "192.168.1.5" };
        const node = buildChefNode(item);
        expect(node.automatic.ipaddress).toBe("192.168.1.5");
    });

    it("omits ipaddress when ip is not set", () => {
        const node = buildChefNode(baseItem);
        expect(node.automatic).not.toHaveProperty("ipaddress");
    });

    it("includes macaddress when mac is set", () => {
        const item = { ...baseItem, mac: "AA:BB:CC:00:11:22" };
        const node = buildChefNode(item);
        expect(node.automatic.macaddress).toBe("AA:BB:CC:00:11:22");
    });

    it("stores blokhouse metadata in normal attrs", () => {
        const node = buildChefNode(baseItem);
        expect(node.normal.blokhouse).toMatchObject({
            id: "item_abc",
            name: "db-01",
            managed: true,
        });
    });

    it("includes description in normal.blokhouse when set", () => {
        const item = { ...baseItem, description: "Primary database" };
        const node = buildChefNode(item);
        expect(node.normal.blokhouse.description).toBe("Primary database");
    });

    it("includes item_type in normal.blokhouse when itemType is set", () => {
        const item = { ...baseItem, itemType: { name: "Database" } };
        const node = buildChefNode(item);
        expect(node.normal.blokhouse.item_type).toBe("Database");
    });

    it("default and override are empty objects", () => {
        const node = buildChefNode(baseItem);
        expect(node.default).toEqual({});
        expect(node.override).toEqual({});
    });

    it("run_list is always an array", () => {
        const node = buildChefNode(baseItem);
        expect(Array.isArray(node.run_list)).toBe(true);
    });

    it("handles itemType names with spaces", () => {
        const item = { ...baseItem, itemType: { name: "Load Balancer" } };
        const node = buildChefNode(item);
        expect(node.chef_environment).toBe("load_balancer");
        expect(node.run_list).toEqual(["role[load_balancer]"]);
    });
});

// ── buildDataBagItem ────────────────────────────────────────────────────────

describe("buildDataBagItem", () => {
    const baseItem = {
        id: "item_xyz",
        name: "cache-01",
    };

    it("returns required data bag item fields", () => {
        const item = buildDataBagItem(baseItem);
        expect(item).toHaveProperty("chef_type", "data_bag_item");
        expect(item).toHaveProperty("data_bag", "blokhouse");
        expect(item).toHaveProperty("blokhouse_id", "item_xyz");
        expect(item).toHaveProperty("name", "cache-01");
    });

    it("creates a safe id from the item name", () => {
        const item = buildDataBagItem(baseItem);
        expect(item.id).toMatch(/^[a-z0-9_-]+$/);
    });

    it("lowercases name for id", () => {
        const item = buildDataBagItem({ ...baseItem, name: "WebServer-01" });
        expect(item.id).toBe("webserver-01");
    });

    it("strips leading/trailing hyphens from id", () => {
        const item = buildDataBagItem({ ...baseItem, name: "---node---" });
        expect(item.id).not.toMatch(/^-|-$/);
    });

    it("includes ip_address when ip is set", () => {
        const item = buildDataBagItem({ ...baseItem, ip: "10.1.2.3" });
        expect(item.ip_address).toBe("10.1.2.3");
    });

    it("omits ip_address when ip is not set", () => {
        const item = buildDataBagItem(baseItem);
        expect(item).not.toHaveProperty("ip_address");
    });

    it("includes mac_address when mac is set", () => {
        const item = buildDataBagItem({ ...baseItem, mac: "DE:AD:BE:EF:00:01" });
        expect(item.mac_address).toBe("DE:AD:BE:EF:00:01");
    });

    it("includes item_type when itemType is set", () => {
        const item = buildDataBagItem({ ...baseItem, itemType: { name: "Cache" } });
        expect(item.item_type).toBe("Cache");
    });

    it("includes description when set", () => {
        const item = buildDataBagItem({ ...baseItem, description: "Redis cache" });
        expect(item.description).toBe("Redis cache");
    });
});
