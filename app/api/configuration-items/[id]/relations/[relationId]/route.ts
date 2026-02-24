import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { authOptions } from "@/lib/authOptions";
import { getServerSession } from "next-auth/next";
import { createAuditLog } from "@/lib/audit";

// DELETE /api/configuration-items/[id]/relations/[relationId] - Delete a relation
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; relationId: string }> }
) {
  const session = await getServerSession(authOptions as any) as any;
  if (!session || !session.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: itemId, relationId } = await params;

  try {
    // Find the relation and verify it belongs to this item
    const relation = await prisma.assetRelation.findFirst({
      where: {
        id: relationId,
        OR: [
          { sourceId: itemId },
          { targetId: itemId },
        ],
      },
      include: {
        source: true,
        target: true,
      },
    });

    if (!relation) {
      return NextResponse.json(
        { error: "Relation not found" },
        { status: 404 }
      );
    }

    // Delete the relation
    await prisma.assetRelation.delete({
      where: { id: relationId },
    });

    // Audit log
    await createAuditLog({
      action: "DELETE",
      entityType: "AssetRelation",
      entityId: relationId,
      userId: session.user.id,
      description: `Deleted ${relation.type} relation between ${relation.source.name} and ${relation.target.name}`,
      oldValues: JSON.stringify({
        sourceId: relation.sourceId,
        targetId: relation.targetId,
        type: relation.type,
        description: relation.description,
      }),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting relation:", error);
    return NextResponse.json(
      { error: "Failed to delete relation" },
      { status: 500 }
    );
  }
}
