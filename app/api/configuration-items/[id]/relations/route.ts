import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { authOptions } from "@/lib/authOptions";
import { getServerSession } from "next-auth/next";
import { createAuditLog } from "@/lib/audit";

// GET /api/configuration-items/[id]/relations - Get all relations for an item
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const item = await prisma.configurationItem.findUnique({
      where: { id },
      include: {
        relationsFrom: {
          include: {
            target: {
              select: {
                id: true,
                name: true,
                ip: true,
                status: true,
                itemType: {
                  select: {
                    name: true,
                  },
                },
              },
            },
          },
        },
        relationsTo: {
          include: {
            source: {
              select: {
                id: true,
                name: true,
                ip: true,
                status: true,
                itemType: {
                  select: {
                    name: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!item) {
      return NextResponse.json({ error: "Configuration item not found" }, { status: 404 });
    }

    // Format relations with direction indicator
    const outgoing = item.relationsFrom.map((rel: any) => ({
      id: rel.id,
      type: rel.type,
      description: rel.description,
      createdAt: rel.createdAt,
      target: rel.target,
      direction: "outgoing",
    }));

    const incoming = item.relationsTo.map((rel: any) => ({
      id: rel.id,
      type: rel.type,
      description: rel.description,
      createdAt: rel.createdAt,
      target: rel.source,
      direction: "incoming",
    }));

    return NextResponse.json({
      outgoing,
      incoming,
      all: [...outgoing, ...incoming],
    });
  } catch (error) {
    console.error("Error fetching relations:", error);
    return NextResponse.json({ error: "Failed to fetch relations" }, { status: 500 });
  }
}

// POST /api/configuration-items/[id]/relations - Create a new relation
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions as any) as any;
  if (!session || !session.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: sourceId } = await params;

  try {
    const body = await request.json();
    const { targetId, type, description } = body;

    if (!targetId || !type) {
      return NextResponse.json(
        { error: "targetId and type are required" },
        { status: 400 }
      );
    }

    // Validate that both items exist
    const [sourceItem, targetItem] = await Promise.all([
      prisma.configurationItem.findUnique({ where: { id: sourceId } }),
      prisma.configurationItem.findUnique({ where: { id: targetId } }),
    ]);

    if (!sourceItem) {
      return NextResponse.json({ error: "Source item not found" }, { status: 404 });
    }

    if (!targetItem) {
      return NextResponse.json({ error: "Target item not found" }, { status: 404 });
    }

    // Prevent self-relations
    if (sourceId === targetId) {
      return NextResponse.json(
        { error: "Cannot create relation to self" },
        { status: 400 }
      );
    }

    // Create the relation
    const relation = await prisma.assetRelation.create({
      data: {
        sourceId,
        targetId,
        type: type.toUpperCase(),
        description,
      },
      include: {
        target: {
          select: {
            id: true,
            name: true,
            ip: true,
            status: true,
            itemType: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    });

    // Audit log
    await createAuditLog({
      action: "CREATE",
      entityType: "AssetRelation",
      entityId: relation.id,
      userId: session.user.id,
      description: `Created ${type} relation from ${sourceItem.name} to ${targetItem.name}`,
      newValues: JSON.stringify({ sourceId, targetId, type, description }),
    });

    return NextResponse.json({
      ...relation,
      direction: "outgoing",
    }, { status: 201 });
  } catch (error: any) {
    console.error("Error creating relation:", error);
    
    // Handle unique constraint violation
    if (error.code === "P2002") {
      return NextResponse.json(
        { error: "Relation already exists" },
        { status: 409 }
      );
    }
    
    return NextResponse.json({ error: "Failed to create relation" }, { status: 500 });
  }
}
