import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { computeImpact, type ImpactEdge } from "@/lib/impact";

// GET /api/configuration-items/[id]/impact - Items affected if this item fails
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { response } = await requireAuth(request, "read");
  if (response) return response;
  const { id } = await params;

  try {
    const root = await prisma.configurationItem.findUnique({
      where: { id },
      select: { id: true, name: true },
    });
    if (!root) {
      return NextResponse.json({ error: "Configuration item not found" }, { status: 404 });
    }

    const loadEdges = (ids: string[]): Promise<ImpactEdge[]> =>
      prisma.assetRelation.findMany({
        where: {
          OR: [
            { targetId: { in: ids }, type: { in: ["DEPENDS_ON", "RUNS_ON"] } },
            { sourceId: { in: ids }, type: "CONTAINS" },
          ],
        },
        select: { sourceId: true, targetId: true, type: true },
        // Stable order, so which path wins for an item reached twice at the same depth never varies
        orderBy: [{ sourceId: "asc" }, { targetId: "asc" }, { type: "asc" }],
      });

    const { nodes, truncated } = await computeImpact(id, loadEdges);

    const ids = Array.from(new Set([id, ...nodes.flatMap((n) => n.path)]));
    const items = await prisma.configurationItem.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        name: true,
        ip: true,
        status: true,
        itemType: { select: { name: true } },
      },
    });
    const byId = new Map(items.map((i) => [i.id, i]));

    const affected = nodes
      .filter((n) => byId.has(n.id))
      .map((n) => {
        const item = byId.get(n.id)!;
        return {
          id: item.id,
          name: item.name,
          ip: item.ip,
          status: item.status,
          itemType: item.itemType,
          depth: n.depth,
          relationType: n.via.type,
          path: n.path.map((pid) => ({ id: pid, name: byId.get(pid)?.name ?? pid })),
        };
      })
      .sort((a, b) => a.depth - b.depth || a.name.localeCompare(b.name));

    return NextResponse.json({ item: { id: root.id, name: root.name }, affected, truncated });
  } catch (error) {
    console.error("Error computing impact:", error);
    return NextResponse.json({ error: "Failed to compute impact" }, { status: 500 });
  }
}
