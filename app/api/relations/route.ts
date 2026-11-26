import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

const END = {
  select: {
    id: true,
    name: true,
    status: true,
    itemType: { select: { name: true } },
  },
};

// GET /api/relations - every relation with both ends, for the relationship graph
export async function GET(request: Request) {
  const { response } = await requireAuth(request, "read");
  if (response) return response;

  try {
    const relations = await prisma.assetRelation.findMany({
      select: {
        id: true,
        sourceId: true,
        targetId: true,
        type: true,
        description: true,
        source: END,
        target: END,
      },
      orderBy: { createdAt: "asc" },
    });
    return NextResponse.json(relations);
  } catch (error) {
    console.error("Error fetching relations:", error);
    return NextResponse.json({ error: "Failed to fetch relations" }, { status: 500 });
  }
}
