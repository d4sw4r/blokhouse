import { NextRequest } from "next/server";
import { getServerSession } from "next-auth/next";
import authOptions from "@/lib/authOptions";
import prisma from "@/lib/prisma";

// GET /api/maintenance - List all maintenance schedules
export async function GET(request: NextRequest) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const session = await getServerSession(authOptions as any) as any;
    if (!session?.user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
        });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const itemId = searchParams.get("itemId");
    const upcoming = searchParams.get("upcoming") === "true";
    const limit = parseInt(searchParams.get("limit") || "50", 10);

    try {
        const where: {
            status?: string;
            configurationItemId?: string;
            scheduledDate?: { gte: Date };
        } = {};

        if (status) where.status = status;
        if (itemId) where.configurationItemId = itemId;
        if (upcoming) {
            where.scheduledDate = { gte: new Date() };
        }

        const schedules = await prisma.maintenanceSchedule.findMany({
            where,
            include: {
                configurationItem: {
                    select: {
                        id: true,
                        name: true,
                        status: true,
                        itemType: { select: { name: true } },
                    },
                },
            },
            orderBy: { scheduledDate: "asc" },
            take: limit,
        });

        return new Response(JSON.stringify({ schedules }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
        });
    } catch (error) {
        console.error("Maintenance schedule fetch error:", error);
        return new Response(
            JSON.stringify({ error: "Failed to fetch maintenance schedules" }),
            { status: 500, headers: { "Content-Type": "application/json" } }
        );
    }
}

// POST /api/maintenance - Create a new maintenance schedule
export async function POST(request: NextRequest) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const session = await getServerSession(authOptions as any) as any;
    if (!session?.user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
        });
    }

    try {
        const body = await request.json();
        const { configurationItemId, title, description, scheduledDate, priority, assignedTo } = body;

        if (!configurationItemId || !title || !scheduledDate) {
            return new Response(
                JSON.stringify({ error: "Missing required fields" }),
                { status: 400, headers: { "Content-Type": "application/json" } }
            );
        }

        const schedule = await prisma.maintenanceSchedule.create({
            data: {
                configurationItemId,
                title,
                description,
                scheduledDate: new Date(scheduledDate),
                priority: priority || "MEDIUM",
                assignedTo,
                createdBy: session.user.id,
            },
            include: {
                configurationItem: {
                    select: {
                        id: true,
                        name: true,
                        status: true,
                        itemType: { select: { name: true } },
                    },
                },
            },
        });

        // Create notification for the assigned user if different from creator
        if (assignedTo && assignedTo !== session.user.id) {
            await prisma.notification.create({
                data: {
                    userId: assignedTo,
                    type: "MAINTENANCE_DUE",
                    title: "New Maintenance Task Assigned",
                    message: `You have been assigned to "${title}" for ${schedule.configurationItem.name}`,
                    entityType: "ConfigurationItem",
                    entityId: configurationItemId,
                },
            });
        }

        return new Response(JSON.stringify(schedule), {
            status: 201,
            headers: { "Content-Type": "application/json" },
        });
    } catch (error) {
        console.error("Maintenance schedule creation error:", error);
        return new Response(
            JSON.stringify({ error: "Failed to create maintenance schedule" }),
            { status: 500, headers: { "Content-Type": "application/json" } }
        );
    }
}
