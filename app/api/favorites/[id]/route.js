import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

// DELETE /api/favorites/[id] - Remove an item from favorites
export async function DELETE(request, { params }) {
  const { auth, response } = await requireAuth(request, "read");
  if (response) return response;

  const { id: configurationItemId } = await params;

  try {
    // Delete the favorite
    await prisma.favoriteItem.deleteMany({
      where: {
        userId: auth.user.id,
        configurationItemId,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to remove favorite:", error);
    return NextResponse.json({ error: "Failed to remove favorite" }, { status: 500 });
  }
}

// GET /api/favorites/[id] - Check if an item is favorited
export async function GET(request, { params }) {
  const { auth, response } = await requireAuth(request, "read");
  if (response) return response;

  const { id: configurationItemId } = await params;

  try {
    const favorite = await prisma.favoriteItem.findUnique({
      where: {
        userId_configurationItemId: {
          userId: auth.user.id,
          configurationItemId,
        },
      },
    });

    return NextResponse.json({ isFavorited: !!favorite });
  } catch (error) {
    console.error("Failed to check favorite status:", error);
    return NextResponse.json({ error: "Failed to check favorite status" }, { status: 500 });
  }
}
