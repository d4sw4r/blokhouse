import { describe, it, expect } from "vitest";
import {
    toPuppetIdentifier,
    buildENCYaml,
    buildDefaultENCYaml,
} from "../lib/puppet-enc.js";

// ── toPuppetIdentifier ──────────────────────────────────────────────────────

describe("toPuppetIdentifier", () => {
    it("lowercases the name", () => {
        expect(toPuppetIdentifier("WebServer")).toBe("webserver");
    });

    it("replaces spaces with underscores", () => {
        expect(toPuppetIdentifier("web server")).toBe("web_server");
    });

    it("replaces special characters with underscores", () => {
        expect(toPuppetIdentifier("DB-01 (primary)")).toBe("db_01_primary");
    });

    it("strips leading and trailing underscores", () => {
        expect(toPuppetIdentifier(" web ")).toBe("web");
    });

    it("collapses multiple separators into one underscore", () => {
        expect(toPuppetIdentifier("a--b  c")).toBe("a_b_c");
    });

    it("returns alphanumeric-only strings unchanged (lowercase)", () => {
        expect(toPuppetIdentifier("database")).toBe("database");
    });
});

// ── buildDefaultENCYaml ─────────────────────────────────────────────────────

describe("buildDefaultENCYaml", () => {
    it("contains the required YAML keys", () => {
        const yaml = buildDefaultENCYaml();
        expect(yaml).toContain("---");
        expect(yaml).toContain("classes:");
        expect(yaml).toContain("base:");
        expect(yaml).toContain("parameters:");
        expect(yaml).toContain("blokhouse_managed: false");
        expect(yaml).toContain("environment: production");
    });

    it("is a non-empty string", () => {
        expect(typeof buildDefaultENCYaml()).toBe("string");
        expect(buildDefaultENCYaml().length).toBeGreaterThan(0);
    });
});

// ── buildENCYaml ────────────────────────────────────────────────────────────

describe("buildENCYaml", () => {
    const baseItem = {
        id: "cuid_abc123",
        name: "web-01",
    };

    it("starts with YAML document marker", () => {
        const yaml = buildENCYaml(baseItem);
        expect(yaml.startsWith("---")).toBe(true);
    });

    it("includes blokhouse_id and blokhouse_name parameters", () => {
        const yaml = buildENCYaml(baseItem);
        expect(yaml).toContain('blokhouse_id: "cuid_abc123"');
        expect(yaml).toContain('blokhouse_name: "web-01"');
    });

    it("uses 'base' as class name when no itemType", () => {
        const yaml = buildENCYaml(baseItem);
        expect(yaml).toContain("  base:");
        expect(yaml).toContain("environment: production");
    });

    it("uses itemType name as class and environment", () => {
        const item = { ...baseItem, itemType: { name: "WebServer" } };
        const yaml = buildENCYaml(item);
        expect(yaml).toContain("  webserver:");
        expect(yaml).toContain("environment: webserver");
        expect(yaml).toContain('item_type: "WebServer"');
    });

    it("includes ip_address when ip is set", () => {
        const item = { ...baseItem, ip: "10.0.0.5" };
        const yaml = buildENCYaml(item);
        expect(yaml).toContain('ip_address: "10.0.0.5"');
    });

    it("omits ip_address when ip is not set", () => {
        const yaml = buildENCYaml(baseItem);
        expect(yaml).not.toContain("ip_address");
    });

    it("includes mac_address when mac is set", () => {
        const item = { ...baseItem, mac: "AA:BB:CC:DD:EE:FF" };
        const yaml = buildENCYaml(item);
        expect(yaml).toContain('mac_address: "AA:BB:CC:DD:EE:FF"');
    });

    it("includes description when set", () => {
        const item = { ...baseItem, description: "Primary web server" };
        const yaml = buildENCYaml(item);
        expect(yaml).toContain('description: "Primary web server"');
    });

    it("escapes double quotes in name", () => {
        const item = { ...baseItem, name: 'he said "hi"' };
        const yaml = buildENCYaml(item);
        expect(yaml).toContain('\\"hi\\"');
    });

    it("always includes managed_by blokhouse", () => {
        const yaml = buildENCYaml(baseItem);
        expect(yaml).toContain('managed_by: "blokhouse"');
    });

    it("ends with a newline", () => {
        const yaml = buildENCYaml(baseItem);
        expect(yaml.endsWith("\n")).toBe(true);
    });

    it("handles itemType names with spaces and dashes", () => {
        const item = { ...baseItem, itemType: { name: "Load Balancer" } };
        const yaml = buildENCYaml(item);
        expect(yaml).toContain("  load_balancer:");
        expect(yaml).toContain("environment: load_balancer");
    });
});
