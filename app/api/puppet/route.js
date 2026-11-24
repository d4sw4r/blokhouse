// app/api/puppet/route.js
// Puppet External Node Classifier (ENC) endpoint
//
// Configure Puppet master (puppet.conf):
//   [master]
//   external_nodes = curl -sf -H "Authorization: Bearer TOKEN" http://blokhouse/api/puppet?node=%s
//   node_terminus = exec
//
// Endpoints:
//   GET /api/puppet              → JSON list of all nodes
//   GET /api/puppet?node=<name>  → YAML ENC for a specific node (by name or IP)

import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { buildENCYaml, buildDefaultENCYaml } from "@/lib/puppet-enc";

export async function GET(req) {
    const { response } = await requireAuth(req, "read");
    if (response) return response;

    const { searchParams } = new URL(req.url);
    const nodeName = searchParams.get("node");

    // --- Single-node ENC mode ---
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

        const yaml = item ? buildENCYaml(item) : buildDefaultENCYaml();
        return new Response(yaml, {
            status: 200,
            headers: { "Content-Type": "text/yaml" },
        });
    }

    // --- Full node list (JSON overview) ---
    const items = await prisma.configurationItem.findMany({
        include: { itemType: true },
        orderBy: { name: "asc" },
    });

    const nodes = items.map((item) => ({
        name: item.name,
        ip: item.ip || null,
        mac: item.mac || null,
        description: item.description || null,
        type: item.itemType ? item.itemType.name : null,
        environment: item.itemType
            ? item.itemType.name.toLowerCase().replace(/[^a-z0-9]+/g, "_")
            : "production",
        enc_url: `/api/puppet?node=${encodeURIComponent(item.name)}`,
    }));

    return new Response(
        JSON.stringify(
            {
                total: nodes.length,
                nodes,
                usage: {
                    puppet_conf: [
                        "[master]",
                        "external_nodes = curl -sf -H 'Authorization: Bearer TOKEN' http://blokhouse/api/puppet?node=%s",
                        "node_terminus = exec",
                    ],
                    note: "Query ?node=<hostname|ip> to get YAML ENC for a specific node",
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
