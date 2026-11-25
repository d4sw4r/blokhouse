import { describe, it, expect } from "vitest";
import {
    toPuppetIdentifier,
    parseClassList,
    buildENC,
    buildUnknownENC,
    encToYaml,
} from "../lib/puppet-enc.js";

const item = {
    id: "cuid_abc123",
    name: "web-01",
    description: 'Says "hi"\nand: more',
    ip: "10.0.0.5",
    mac: null,
    status: "ACTIVE",
    type: "Web Server",
    tags: ["prod", "web"],
    customFields: { rack: "14" },
    source: "puppet",
    externalId: "web-01.example.com",
};

describe("toPuppetIdentifier", () => {
    it("makes Puppet-safe identifiers", () => {
        expect(toPuppetIdentifier("Web Server")).toBe("web_server");
        expect(toPuppetIdentifier("DB-01 (primary)")).toBe("db_01_primary");
        expect(toPuppetIdentifier(" web ")).toBe("web");
    });
});

describe("parseClassList", () => {
    it("splits on commas and whitespace and drops duplicates", () => {
        expect(parseClassList("role::web, profile::base\nprofile::base  profile::x")).toEqual([
            "role::web",
            "profile::base",
            "profile::x",
        ]);
        expect(parseClassList(undefined)).toEqual([]);
        expect(parseClassList(" ")).toEqual([]);
    });
});

describe("buildENC", () => {
    // Regression: the type used to become the environment and a class ("web_server"),
    // which made Puppet fail for every node that has a type.
    it("sets no classes and no environment without the puppet_* custom fields", () => {
        const enc = buildENC(item);
        expect(enc.classes).toEqual({});
        expect(enc).not.toHaveProperty("environment");
    });

    it("takes classes and environment from the custom fields", () => {
        const enc = buildENC({
            ...item,
            customFields: { puppet_classes: "role::web, profile::monitoring", puppet_environment: " staging " },
        });
        expect(enc.classes).toEqual({ "role::web": {}, "profile::monitoring": {} });
        expect(enc.environment).toBe("staging");
    });

    it("passes all fields as the $blokhouse hash", () => {
        expect(buildENC(item).parameters.blokhouse).toEqual({
            id: "cuid_abc123",
            name: "web-01",
            description: 'Says "hi"\nand: more',
            ip: "10.0.0.5",
            mac: null,
            status: "ACTIVE",
            type: "Web Server",
            tags: ["prod", "web"],
            custom_fields: { rack: "14" },
            source: "puppet",
            external_id: "web-01.example.com",
        });
    });

    it("keeps the variables of earlier versions", () => {
        const p = buildENC(item).parameters;
        expect(p).toMatchObject({
            blokhouse_id: "cuid_abc123",
            blokhouse_name: "web-01",
            ip_address: "10.0.0.5",
            item_type: "Web Server",
            managed_by: "blokhouse",
        });
        expect(p).not.toHaveProperty("mac_address");
    });
});

// The document is "---" followed by JSON (a subset of YAML). Puppet's own YAML
// parser is exercised by the end-to-end test in integrations/puppet.
const load = (yaml) => JSON.parse(yaml.replace(/^---\n/, ""));

describe("encToYaml", () => {
    it("produces YAML that round-trips, including quotes, newlines and colons", () => {
        const yaml = encToYaml(buildENC(item));
        expect(yaml.startsWith("---\n")).toBe(true);
        expect(load(yaml)).toEqual(buildENC(item));
    });

    it("unknown nodes get no classes and no environment", () => {
        expect(load(encToYaml(buildUnknownENC()))).toEqual({ classes: {}, parameters: { blokhouse_managed: false } });
    });
});
