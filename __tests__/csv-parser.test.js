import { describe, it, expect } from "vitest";
import { isValidIp, isValidMac, normaliseStatus, parseCsv } from "../lib/csv-parser.js";

// ── isValidIp ────────────────────────────────────────────────────────────────

describe("isValidIp", () => {
    it("accepts a valid IPv4 address", () => {
        expect(isValidIp("192.168.1.10")).toBe(true);
    });

    it("accepts boundary octets (0 and 255)", () => {
        expect(isValidIp("0.0.0.0")).toBe(true);
        expect(isValidIp("255.255.255.255")).toBe(true);
    });

    it("rejects an octet above 255", () => {
        expect(isValidIp("192.168.1.256")).toBe(false);
    });

    it("rejects an octet with a negative number", () => {
        expect(isValidIp("192.168.-1.1")).toBe(false);
    });

    it("rejects an address with fewer than 4 octets", () => {
        expect(isValidIp("192.168.1")).toBe(false);
    });

    it("rejects an address with more than 4 octets", () => {
        expect(isValidIp("192.168.1.1.1")).toBe(false);
    });

    it("rejects a hostname string", () => {
        expect(isValidIp("my-server")).toBe(false);
    });

    it("rejects an empty string", () => {
        expect(isValidIp("")).toBe(false);
    });
});

// ── isValidMac ───────────────────────────────────────────────────────────────

describe("isValidMac", () => {
    it("accepts colon-separated MAC", () => {
        expect(isValidMac("00:11:22:33:44:55")).toBe(true);
    });

    it("accepts dash-separated MAC", () => {
        expect(isValidMac("00-11-22-33-44-55")).toBe(true);
    });

    it("accepts uppercase hex digits", () => {
        expect(isValidMac("AA:BB:CC:DD:EE:FF")).toBe(true);
    });

    it("accepts lowercase hex digits", () => {
        expect(isValidMac("aa:bb:cc:dd:ee:ff")).toBe(true);
    });

    it("rejects a MAC with too few groups", () => {
        expect(isValidMac("00:11:22:33:44")).toBe(false);
    });

    it("rejects a MAC with too many groups", () => {
        expect(isValidMac("00:11:22:33:44:55:66")).toBe(false);
    });

    it("rejects a MAC with non-hex characters", () => {
        expect(isValidMac("GG:11:22:33:44:55")).toBe(false);
    });

    it("rejects an empty string", () => {
        expect(isValidMac("")).toBe(false);
    });
});

// ── normaliseStatus ──────────────────────────────────────────────────────────

describe("normaliseStatus", () => {
    it("returns ACTIVE for undefined", () => {
        expect(normaliseStatus(undefined)).toBe("ACTIVE");
    });

    it("returns ACTIVE for an empty string", () => {
        expect(normaliseStatus("")).toBe("ACTIVE");
    });

    it("accepts ACTIVE (case-insensitive)", () => {
        expect(normaliseStatus("active")).toBe("ACTIVE");
        expect(normaliseStatus("Active")).toBe("ACTIVE");
        expect(normaliseStatus("ACTIVE")).toBe("ACTIVE");
    });

    it("accepts MAINTENANCE (case-insensitive)", () => {
        expect(normaliseStatus("maintenance")).toBe("MAINTENANCE");
        expect(normaliseStatus("MAINTENANCE")).toBe("MAINTENANCE");
    });

    it("accepts DEPRECATED (case-insensitive)", () => {
        expect(normaliseStatus("deprecated")).toBe("DEPRECATED");
        expect(normaliseStatus("DEPRECATED")).toBe("DEPRECATED");
    });

    it("returns ACTIVE for an unrecognised value", () => {
        expect(normaliseStatus("unknown")).toBe("ACTIVE");
        expect(normaliseStatus("RETIRED")).toBe("ACTIVE");
    });

    it("trims surrounding whitespace before matching", () => {
        expect(normaliseStatus("  MAINTENANCE  ")).toBe("MAINTENANCE");
    });
});

// ── parseCsv ─────────────────────────────────────────────────────────────────

describe("parseCsv", () => {
    const HEADER = "name,description,ip,mac,itemtypeid,status";

    // ── Basic happy-path ──────────────────────────────────────────────────

    it("parses a single valid row", () => {
        const csv = [HEADER, "web-01,Main server,10.0.0.1,00:11:22:33:44:55,type-abc,ACTIVE"].join("\n");
        const { items, errors, skipped } = parseCsv(csv);
        expect(errors).toHaveLength(0);
        expect(skipped).toBe(0);
        expect(items).toHaveLength(1);
        expect(items[0]).toMatchObject({
            name: "web-01",
            description: "Main server",
            ip: "10.0.0.1",
            mac: "00:11:22:33:44:55",
            itemTypeId: "type-abc",
            status: "ACTIVE",
        });
    });

    it("parses multiple valid rows", () => {
        const csv = [
            HEADER,
            "srv-a,,10.0.0.1,,,ACTIVE",
            "srv-b,Desc,10.0.0.2,AA:BB:CC:DD:EE:FF,,MAINTENANCE",
        ].join("\n");
        const { items, errors } = parseCsv(csv);
        expect(errors).toHaveLength(0);
        expect(items).toHaveLength(2);
    });

    it("attaches userId to every item when provided", () => {
        const csv = [HEADER, "srv,,,,,"].join("\n");
        const { items } = parseCsv(csv, "user-xyz");
        expect(items[0].userId).toBe("user-xyz");
    });

    it("does not add userId key when not provided", () => {
        const csv = [HEADER, "srv,,,,,"].join("\n");
        const { items } = parseCsv(csv);
        expect(items[0]).not.toHaveProperty("userId");
    });

    // ── Optional fields ────────────────────────────────────────────────────

    it("sets ip to null when column is empty", () => {
        const csv = [HEADER, "srv,,,,, "].join("\n");
        const { items } = parseCsv(csv);
        expect(items[0].ip).toBeNull();
    });

    it("sets mac to null when column is empty", () => {
        const csv = [HEADER, "srv,,,,,"].join("\n");
        const { items } = parseCsv(csv);
        expect(items[0].mac).toBeNull();
    });

    it("sets itemTypeId to null when column is empty", () => {
        const csv = [HEADER, "srv,,,,,"].join("\n");
        const { items } = parseCsv(csv);
        expect(items[0].itemTypeId).toBeNull();
    });

    it("defaults status to ACTIVE when column is empty", () => {
        const csv = [HEADER, "srv,,,,,"].join("\n");
        const { items } = parseCsv(csv);
        expect(items[0].status).toBe("ACTIVE");
    });

    it("normalises lowercase status values", () => {
        const csv = [HEADER, "srv,,,,,deprecated"].join("\n");
        const { items } = parseCsv(csv);
        expect(items[0].status).toBe("DEPRECATED");
    });

    // ── Validation errors ──────────────────────────────────────────────────

    it("skips and reports rows missing the name field", () => {
        const csv = [HEADER, ",desc,10.0.0.1,,,ACTIVE"].join("\n");
        const { items, errors, skipped } = parseCsv(csv);
        expect(items).toHaveLength(0);
        expect(skipped).toBe(1);
        expect(errors[0].message).toMatch(/name/i);
        expect(errors[0].row).toBe(2);
    });

    it("skips and reports rows with invalid IP addresses", () => {
        const csv = [HEADER, "srv,,999.0.0.1,,,"].join("\n");
        const { items, errors, skipped } = parseCsv(csv);
        expect(items).toHaveLength(0);
        expect(skipped).toBe(1);
        expect(errors[0].message).toMatch(/IP/i);
    });

    it("skips and reports rows with invalid MAC addresses", () => {
        const csv = [HEADER, "srv,,,ZZ:ZZ:ZZ:ZZ:ZZ:ZZ,,"].join("\n");
        const { items, errors, skipped } = parseCsv(csv);
        expect(items).toHaveLength(0);
        expect(skipped).toBe(1);
        expect(errors[0].message).toMatch(/MAC/i);
    });

    it("processes valid rows even when some rows are invalid", () => {
        const csv = [
            HEADER,
            "good,,,,,ACTIVE",
            ",bad-row,,,",          // missing name
            "also-good,,,,,",
        ].join("\n");
        const { items, errors, skipped } = parseCsv(csv);
        expect(items).toHaveLength(2);
        expect(skipped).toBe(1);
        expect(errors).toHaveLength(1);
    });

    // ── Edge cases ─────────────────────────────────────────────────────────

    it("handles Windows-style CRLF line endings", () => {
        const csv = [HEADER, "srv-win,,10.0.0.5,,,ACTIVE"].join("\r\n");
        const { items, errors } = parseCsv(csv);
        expect(errors).toHaveLength(0);
        expect(items).toHaveLength(1);
        expect(items[0].name).toBe("srv-win");
    });

    it("ignores blank lines in the input", () => {
        const csv = [HEADER, "", "srv,,,,, ", ""].join("\n");
        const { items } = parseCsv(csv);
        expect(items).toHaveLength(1);
    });

    it("returns an error when csv is null", () => {
        const { items, errors } = parseCsv(null);
        expect(items).toHaveLength(0);
        expect(errors[0].message).toMatch(/no csv/i);
    });

    it("returns an error when csv has only a header row", () => {
        const { items, errors } = parseCsv(HEADER);
        expect(items).toHaveLength(0);
        expect(errors[0].message).toMatch(/header/i);
    });

    it("is case-insensitive for header column names", () => {
        const csv = ["Name,Description,IP,MAC,ItemTypeId,Status", "srv,,,,,"].join("\n");
        const { items, errors } = parseCsv(csv);
        expect(errors).toHaveLength(0);
        expect(items[0].name).toBe("srv");
    });

    it("trims whitespace from cell values", () => {
        const csv = [HEADER, "  srv  ,  desc  ,  10.0.0.1  ,  ,  ,  ACTIVE  "].join("\n");
        const { items } = parseCsv(csv);
        expect(items[0].name).toBe("srv");
        expect(items[0].description).toBe("desc");
        expect(items[0].ip).toBe("10.0.0.1");
        expect(items[0].status).toBe("ACTIVE");
    });

    it("reports the correct (1-based) row number in errors", () => {
        const csv = [HEADER, "good,,,,,", ",bad,,,,,", "good2,,,,,"].join("\n");
        const { errors } = parseCsv(csv);
        // header=row1, first data row=row2, second data row=row3
        expect(errors[0].row).toBe(3);
    });
});
