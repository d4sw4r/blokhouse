/**
 * lib/chef-node.js
 * Pure utility functions for building Chef Infra node/data-bag objects.
 * Extracted here to allow unit testing without database dependencies.
 */

/**
 * Converts a name into a Chef-safe environment/role identifier.
 * e.g. "Web Server" → "web_server"
 * @param {string} name
 * @returns {string}
 */
export function toChefIdentifier(name) {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

/**
 * Build a Chef::Node object for a given ConfigurationItem.
 * @param {{ id: string, name: string, description?: string, ip?: string, mac?: string, itemType?: { name: string } | null }} item
 * @returns {object}
 */
export function buildChefNode(item) {
    const envName = item.itemType
        ? toChefIdentifier(item.itemType.name)
        : "_default";

    const roleName = item.itemType
        ? `role[${toChefIdentifier(item.itemType.name)}]`
        : "role[base]";

    return {
        name: item.name,
        chef_type: "node",
        json_class: "Chef::Node",
        chef_environment: envName,
        run_list: [roleName],
        automatic: {
            ...(item.ip && { ipaddress: item.ip }),
            ...(item.mac && { macaddress: item.mac }),
            hostname: item.name,
            fqdn: item.name,
        },
        normal: {
            blokhouse: {
                id: item.id,
                name: item.name,
                ...(item.description && { description: item.description }),
                ...(item.itemType && { item_type: item.itemType.name }),
                managed: true,
            },
        },
        default: {},
        override: {},
    };
}

/**
 * Build a Chef Data Bag Item for a given ConfigurationItem.
 * @param {{ id: string, name: string, description?: string, ip?: string, mac?: string, itemType?: { name: string } | null }} item
 * @returns {object}
 */
export function buildDataBagItem(item) {
    return {
        id: item.name.toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, ""),
        blokhouse_id: item.id,
        name: item.name,
        ...(item.description && { description: item.description }),
        ...(item.ip && { ip_address: item.ip }),
        ...(item.mac && { mac_address: item.mac }),
        ...(item.itemType && { item_type: item.itemType.name }),
        chef_type: "data_bag_item",
        data_bag: "blokhouse",
    };
}
