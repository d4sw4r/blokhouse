// app/api/ansible/route.js
import prisma from "@/lib/prisma";

export async function GET() {
    // Fetch all configuration items from the database.
    // Optionally, you can filter out items without an IP address.
    const items = await prisma.configurationItem.findMany({
        include: { itemType: true }
    });

    // Build the "all" group: all hosts that have an IP.
    const allHosts = items
        .filter((item) => item.ip)
        .map((item) => item.name);

    // Prepare host variables for each host.
    const hostvars = {};
    items.forEach((item) => {
        if (item.ip) {
            hostvars[item.name] = {
                ansible_host: item.ip,
                ...(item.mac && { mac: item.mac }),
                ...(item.description && { description: item.description }),
            };
        }
    });

    // Build groups by itemType.
    const groups = {};
    items.forEach((item) => {
        if (!item.ip) return; // only include items with an IP address

        // Determine the group name: use the itemType name if present; otherwise "ungrouped"
        const groupName = item.itemType && item.itemType.name
            ? item.itemType.name
            : "ungrouped";

        if (!groups[groupName]) {
            groups[groupName] = { hosts: [], vars: {} };
        }
        groups[groupName].hosts.push(item.name);
    });

    // Compose the final inventory object.
    const inventory = {
        all: {
            hosts: allHosts,
            vars: {},
        },
        ...groups,
        _meta: {
            hostvars,
        },
    };

    return new Response(JSON.stringify(inventory, null, 2), {
        status: 200,
        headers: { "Content-Type": "application/json" },
    });
}
