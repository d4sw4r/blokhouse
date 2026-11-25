// app/api/puppet/route.js
// Puppet External Node Classifier (ENC) endpoint
//
//   GET /api/puppet              → JSON list of all nodes
//   GET /api/puppet?node=<name>  → ENC document (YAML) for one node
//
// Use the ENC script of the Puppet module in integrations/puppet, or:
//   [server]
//   node_terminus  = exec
//   external_nodes = /usr/local/bin/blokhouse-enc   (curl -fsS ... "/api/puppet?node=$1")
//
// A node is found by, in this order: source "puppet" + externalId = certname
// (set by the Blokhouse report processor), name (case-insensitive), IP address.

import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { ITEM_INCLUDE, serializeItem } from "@/lib/api/v1/items";
import { buildENC, buildUnknownENC, encToYaml, ENVIRONMENT_FIELD, CLASSES_FIELD, parseClassList } from "@/lib/puppet-enc";

const ORDER = [{ createdAt: "asc" }, { id: "asc" }];

async function findNode(certname) {
    const byExternalId = await prisma.configurationItem.findUnique({
        where: { source_externalId: { source: "puppet", externalId: certname } },
        include: ITEM_INCLUDE,
    });
    if (byExternalId) return byExternalId;
    return (
        (await prisma.configurationItem.findFirst({
            where: { name: { equals: certname, mode: "insensitive" } },
            include: ITEM_INCLUDE,
            orderBy: ORDER,
        })) ??
        (await prisma.configurationItem.findFirst({ where: { ip: certname }, include: ITEM_INCLUDE, orderBy: ORDER }))
    );
}

export async function GET(req) {
    const { response } = await requireAuth(req, "read");
    if (response) return response;

    const { searchParams } = new URL(req.url);
    const nodeName = searchParams.get("node");

    // --- Single-node ENC mode ---
    if (nodeName !== null) {
        const item = nodeName ? await findNode(nodeName) : null;
        const enc = item ? buildENC(serializeItem(item)) : buildUnknownENC();
        return new Response(encToYaml(enc), {
            status: 200,
            headers: { "Content-Type": "text/yaml; charset=utf-8" },
        });
    }

    // --- Full node list (JSON overview) ---
    const items = await prisma.configurationItem.findMany({ include: ITEM_INCLUDE, orderBy: { name: "asc" } });

    const nodes = items.map((raw) => {
        const item = serializeItem(raw);
        return {
            name: item.name,
            ip: item.ip,
            mac: item.mac,
            description: item.description,
            type: item.type,
            certname: item.source === "puppet" ? item.externalId : null,
            classes: parseClassList(item.customFields[CLASSES_FIELD]),
            environment: item.customFields[ENVIRONMENT_FIELD]?.trim() || null,
            enc_url: `/api/puppet?node=${encodeURIComponent(item.source === "puppet" ? item.externalId : item.name)}`,
        };
    });

    return Response.json({
        total: nodes.length,
        nodes,
        usage: {
            enc: "GET /api/puppet?node=<certname> returns the ENC document for a node",
            classification: `Set the custom fields '${CLASSES_FIELD}' and '${ENVIRONMENT_FIELD}' on an item to assign classes and an environment`,
            docs: "docs/integrations/puppet.md",
        },
    });
}
