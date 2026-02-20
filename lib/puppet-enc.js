/**
 * lib/puppet-enc.js
 * Pure utility functions for building Puppet ENC YAML output.
 * Extracted here to allow unit testing without database dependencies.
 */

/**
 * Converts a human-readable name into a Puppet-safe class/environment name.
 * e.g. "Web Server" → "web_server"
 * @param {string} name
 * @returns {string}
 */
export function toPuppetIdentifier(name) {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

/**
 * Build the Puppet ENC YAML string for a given ConfigurationItem.
 * Puppet ENC format:
 *   ---
 *   classes:
 *     <class>:
 *   parameters:
 *     <key>: "<value>"
 *   environment: <env>
 *
 * @param {{ id: string, name: string, description?: string, ip?: string, mac?: string, itemType?: { name: string } | null }} item
 * @returns {string} YAML string
 */
export function buildENCYaml(item) {
    const lines = ["---"];

    const className = item.itemType
        ? toPuppetIdentifier(item.itemType.name)
        : "base";

    lines.push("classes:");
    lines.push(`  ${className}:`);

    lines.push("parameters:");
    lines.push(`  blokhouse_id: "${item.id}"`);
    lines.push(`  blokhouse_name: "${item.name.replace(/"/g, '\\"')}"`);

    if (item.description) {
        lines.push(`  description: "${item.description.replace(/"/g, '\\"')}"`);
    }
    if (item.ip) {
        lines.push(`  ip_address: "${item.ip}"`);
    }
    if (item.mac) {
        lines.push(`  mac_address: "${item.mac}"`);
    }
    if (item.itemType) {
        lines.push(`  item_type: "${item.itemType.name.replace(/"/g, '\\"')}"`);
    }
    lines.push(`  managed_by: "blokhouse"`);

    const environment = item.itemType
        ? toPuppetIdentifier(item.itemType.name)
        : "production";
    lines.push(`environment: ${environment}`);

    return lines.join("\n") + "\n";
}

/**
 * Build the minimal default ENC YAML for an unknown node.
 * @returns {string}
 */
export function buildDefaultENCYaml() {
    return [
        "---",
        "classes:",
        "  base:",
        "parameters:",
        "  blokhouse_managed: false",
        "environment: production",
        "",
    ].join("\n");
}
