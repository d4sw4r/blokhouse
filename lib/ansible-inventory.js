/**
 * lib/ansible-inventory.js
 * Pure utility functions for building Ansible dynamic inventory JSON.
 * Extracted here to allow unit testing without database dependencies.
 *
 * Ansible dynamic inventory format:
 *   {
 *     "all": { "hosts": [...], "vars": {} },
 *     "<group>": { "hosts": [...], "vars": {} },
 *     "_meta": { "hostvars": { "<hostname>": { ... } } }
 *   }
 */

/**
 * Build an Ansible dynamic inventory object from a list of ConfigurationItems.
 *
 * - Only items with an IP address are included.
 * - Items are grouped by their itemType name (fallback: "ungrouped").
 * - hostvars include ansible_host (IP), mac, description, and status.
 *
 * @param {Array<{
 *   id: string,
 *   name: string,
 *   ip?: string|null,
 *   mac?: string|null,
 *   description?: string|null,
 *   status: string,
 *   itemType?: { name: string } | null
 * }>} items
 * @returns {{
 *   all: { hosts: string[], vars: object },
 *   _meta: { hostvars: object },
 *   [group: string]: { hosts: string[], vars: object }
 * }}
 */
export function buildAnsibleInventory(items) {
    const allHosts = items.filter((item) => item.ip).map((item) => item.name);

    const hostvars = {};
    items.forEach((item) => {
        if (!item.ip) return;
        hostvars[item.name] = {
            ansible_host: item.ip,
            ...(item.mac && { mac: item.mac }),
            ...(item.description && { description: item.description }),
            status: item.status,
        };
    });

    const groups = {};
    items.forEach((item) => {
        if (!item.ip) return;
        const groupName =
            item.itemType && item.itemType.name ? item.itemType.name : "ungrouped";
        if (!groups[groupName]) {
            groups[groupName] = { hosts: [], vars: {} };
        }
        groups[groupName].hosts.push(item.name);
    });

    return {
        all: {
            hosts: allHosts,
            vars: {},
        },
        ...groups,
        _meta: {
            hostvars,
        },
    };
}
