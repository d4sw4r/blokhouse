import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import authOptions from "@/lib/authOptions";
import prisma from "@/lib/prisma";

// GET /api/favorites - Get all favorites for the current user
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const favorites = await prisma.favoriteItem.findMany({
      where: { userId: session.user.id },
      include: {
        configurationItem: {
          include: {
            itemType: true,
            tags: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(favorites);
  } catch (error) {
    console.error("Failed to fetch favorites:", error);
    return NextResponse.json({ error: "Failed to fetch favorites" }, { status: 500 });
  }
}

// POST /api/favorites - Add an item to favorites
export async function POST(request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { configurationItemId } = body;

    if (!configurationItemId) {
      return NextResponse.json({ error: "configurationItemId is required" }, { status: 400 });
    }

    // Check if item exists
    const item = await prisma.configurationItem.findUnique({
      where: { id: configurationItemId },
    });

    if (!item) {
      return NextResponse.json({ error: "Configuration item not found" }, { status: 404 });
    }

    // Create favorite (unique constraint will prevent duplicates)
    const favorite = await prisma.favoriteItem.create({
      data: {
        userId: session.user.id,
        configurationItemId,
      },
      include: {
        configurationItem: {
          include: {
            itemType: true,
            tags: true,
          },
        },
      },
    });

    return NextResponse.json(favorite, { status: 201 });
  } catch (error) {
    // Handle unique constraint violation
    if (error.code === "P2002") {
      return NextResponse.json({ error: "Item is already in favorites" }, { status: 409 });
    }
    console.error("Failed to add favorite:", error);
    return NextResponse.json({ error: "Failed to add favorite" }, { status: 500 });
  }
}
