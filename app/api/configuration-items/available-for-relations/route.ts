import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// GET /api/configuration-items/available-for-relations - Get items available for relations
// Used for dropdown when creating relations
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const excludeId = searchParams.get("exclude");
    const search = searchParams.get("search");

    const items = await prisma.configurationItem.findMany({
      where: {
        ...(excludeId ? { id: { not: excludeId } } : {}),
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: "insensitive" } },
                { ip: { contains: search, mode: "insensitive" } },
              ],
            }
          : {}),
        status: "ACTIVE",
      },
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
      orderBy: {
        name: "asc",
      },
      take: 50,
    });

    return NextResponse.json(items);
  } catch (error) {
    console.error("Error fetching available items:", error);
    return NextResponse.json(
      { error: "Failed to fetch items" },
      { status: 500 }
    );
  }
}
