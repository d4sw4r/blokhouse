// app/api/chef/route.js
// Chef Infra inventory / node data endpoint
//
// Endpoints:
//   GET /api/chef                   → all nodes as JSON (Chef::Node format)
//   GET /api/chef?node=<name>       → single Chef Node object
//   GET /api/chef?format=databag    → Chef Data Bag (data_bags/blokhouse/*)
//
// Example usage:
//   curl -H "Authorization: Bearer TOKEN" http://blokhouse/api/chef
//   curl -H "Authorization: Bearer TOKEN" http://blokhouse/api/chef?node=web-01
//   curl -H "Authorization: Bearer TOKEN" "http://blokhouse/api/chef?format=databag"

import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import authOptions from "@/lib/authOptions";
import { buildChefNode, buildDataBagItem } from "@/lib/chef-node";

async function checkAuth(req) {
    const authHeader = req.headers.get("authorization");
    if (authHeader && authHeader.startsWith("Bearer ")) {
        const token = authHeader.slice("Bearer ".length).trim();
        try {
            const record = await prisma.apiToken.findUnique({ where: { token } });
            if (record) return true;
        } catch (e) {
            console.error("Token check error:", e);
        }
    }
    const session = await getServerSession(authOptions);
    return !!session;
}

export async function GET(req) {
    const authed = await checkAuth(req);
    if (!authed) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
        });
    }

    const { searchParams } = new URL(req.url);
    const nodeName = searchParams.get("node");
    const format = searchParams.get("format");

    // --- Single node (Chef::Node JSON) ---
    if (nodeName) {
        const item = await prisma.configurationItem.findFirst({
            where: {
                OR: [
                    { name: nodeName },
                    { ip: nodeName },
                ],
            },
            include: { itemType: true },
        });

        if (!item) {
            return new Response(
                JSON.stringify({ error: `Node '${nodeName}' not found in Blokhouse` }),
                { status: 404, headers: { "Content-Type": "application/json" } }
            );
        }

        return new Response(JSON.stringify(buildChefNode(item), null, 2), {
            status: 200,
            headers: { "Content-Type": "application/json" },
        });
    }

    // Fetch all items
    const items = await prisma.configurationItem.findMany({
        include: { itemType: true },
        orderBy: { name: "asc" },
    });

    // --- Data Bag format ---
    if (format === "databag") {
        const dataBag = {
            name: "blokhouse",
            chef_type: "data_bag",
            json_class: "Chef::DataBag",
            items: items.map(buildDataBagItem),
        };

        return new Response(JSON.stringify(dataBag, null, 2), {
            status: 200,
            headers: { "Content-Type": "application/json" },
        });
    }

    // --- Default: full node list ---
    const environments = {};
    const nodes = items.map((item) => {
        const env = item.itemType
            ? item.itemType.name.toLowerCase().replace(/[^a-z0-9]+/g, "_")
            : "_default";
        if (!environments[env]) environments[env] = [];
        environments[env].push(item.name);
        return buildChefNode(item);
    });

    return new Response(
        JSON.stringify(
            {
                total: nodes.length,
                environments,
                nodes,
                usage: {
                    all_nodes: "GET /api/chef  →  full node list as Chef::Node objects",
                    single_node: "GET /api/chef?node=<hostname|ip>  →  single Chef::Node",
                    data_bag: "GET /api/chef?format=databag  →  Chef Data Bag",
                },
            },
            null,
            2
        ),
        {
            status: 200,
            headers: { "Content-Type": "application/json" },
        }
    );
}
