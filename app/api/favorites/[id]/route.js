import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import authOptions from "@/lib/authOptions";
import prisma from "@/lib/prisma";

// DELETE /api/favorites/[id] - Remove an item from favorites
export async function DELETE(request, { params }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: configurationItemId } = await params;

  try {
    // Delete the favorite
    await prisma.favoriteItem.deleteMany({
      where: {
        userId: session.user.id,
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
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: configurationItemId } = await params;

  try {
    const favorite = await prisma.favoriteItem.findUnique({
      where: {
        userId_configurationItemId: {
          userId: session.user.id,
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
