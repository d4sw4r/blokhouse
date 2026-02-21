/**
 * lib/csv-parser.js
 * Pure utility functions for parsing and validating CMDB CSV imports.
 * Extracted here to allow unit testing without database dependencies.
 *
 * Expected CSV format (header row required):
 *   name,description,ip,mac,itemtypeid,status
 *
 * Rules:
 *   - "name" is required for every row.
 *   - "status" must be one of ACTIVE | MAINTENANCE | DEPRECATED (case-insensitive); defaults to ACTIVE.
 *   - IP addresses are validated with a simple regex if provided.
 *   - MAC addresses are validated if provided.
 *   - Rows with an empty "name" are skipped and reported.
 */

const VALID_STATUSES = new Set(["ACTIVE", "MAINTENANCE", "DEPRECATED"]);

const IP_RE =
    /^(\d{1,3}\.){3}\d{1,3}$/;

const MAC_RE =
    /^([0-9A-Fa-f]{2}[:-]){5}[0-9A-Fa-f]{2}$/;

/**
 * Validate an IPv4 address string.
 * @param {string} ip
 * @returns {boolean}
 */
export function isValidIp(ip) {
    if (!IP_RE.test(ip)) return false;
    return ip.split(".").every((octet) => {
        const n = parseInt(octet, 10);
        return n >= 0 && n <= 255;
    });
}

/**
 * Validate a MAC address string (colon or dash separated).
 * @param {string} mac
 * @returns {boolean}
 */
export function isValidMac(mac) {
    return MAC_RE.test(mac);
}

/**
 * Normalise a status string to one of the valid enum values.
 * Returns "ACTIVE" if the value is missing or unrecognised.
 * @param {string|undefined} value
 * @returns {"ACTIVE"|"MAINTENANCE"|"DEPRECATED"}
 */
export function normaliseStatus(value) {
    if (!value) return "ACTIVE";
    const upper = value.trim().toUpperCase();
    return VALID_STATUSES.has(upper) ? upper : "ACTIVE";
}

/**
 * Parse a raw CSV string into an array of configuration-item objects
 * ready for database insertion.
 *
 * @param {string} csv  Raw CSV text (may use \r\n or \n line endings).
 * @param {string} [userId]  Optional userId to attach to every item.
 * @returns {{
 *   items: Array<{
 *     name: string,
 *     description: string,
 *     ip: string|null,
 *     mac: string|null,
 *     itemTypeId: string|null,
 *     status: "ACTIVE"|"MAINTENANCE"|"DEPRECATED",
 *     userId: string|undefined
 *   }>,
 *   errors: Array<{ row: number, message: string }>,
 *   skipped: number
 * }}
 */
export function parseCsv(csv, userId) {
    const items = [];
    const errors = [];
    let skipped = 0;

    if (!csv || typeof csv !== "string") {
        return { items, errors: [{ row: 0, message: "No CSV content provided" }], skipped };
    }

    const lines = csv.split(/\r?\n/).filter((l) => l.trim() !== "");

    if (lines.length < 2) {
        return {
            items,
            errors: [{ row: 0, message: "CSV must have a header row and at least one data row" }],
            skipped,
        };
    }

    // Parse header – normalise to lowercase, trim whitespace
    const header = lines[0].split(",").map((h) => h.trim().toLowerCase());

    for (let i = 1; i < lines.length; i++) {
        const rowNum = i + 1; // 1-based, counting the header as row 1
        const cells = lines[i].split(",").map((c) => c.trim());

        // Build a key→value map for this row
        const row = {};
        header.forEach((col, idx) => {
            row[col] = cells[idx] ?? "";
        });

        // Required field
        if (!row.name) {
            errors.push({ row: rowNum, message: "Missing required field: name" });
            skipped++;
            continue;
        }

        // Optional IP validation
        const ip = row.ip || null;
        if (ip && !isValidIp(ip)) {
            errors.push({ row: rowNum, message: `Invalid IP address: "${ip}"` });
            skipped++;
            continue;
        }

        // Optional MAC validation
        const mac = row.mac || null;
        if (mac && !isValidMac(mac)) {
            errors.push({ row: rowNum, message: `Invalid MAC address: "${mac}"` });
            skipped++;
            continue;
        }

        items.push({
            name: row.name,
            description: row.description || "",
            ip,
            mac,
            itemTypeId: row.itemtypeid || null,
            status: normaliseStatus(row.status),
            ...(userId !== undefined && { userId }),
        });
    }

    return { items, errors, skipped };
}
