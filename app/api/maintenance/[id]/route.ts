import { NextRequest } from "next/server";
import { getServerSession } from "next-auth/next";
import authOptions from "@/lib/authOptions";
import prisma from "@/lib/prisma";

// GET /api/maintenance/[id] - Get a single maintenance schedule
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const session = await getServerSession(authOptions as any) as any;
    if (!session?.user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
        });
    }

    try {
        const { id } = await params;
        const schedule = await prisma.maintenanceSchedule.findUnique({
            where: { id },
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

        if (!schedule) {
            return new Response(
                JSON.stringify({ error: "Maintenance schedule not found" }),
                { status: 404, headers: { "Content-Type": "application/json" } }
            );
        }

        return new Response(JSON.stringify(schedule), {
            status: 200,
            headers: { "Content-Type": "application/json" },
        });
    } catch (error) {
        console.error("Maintenance schedule fetch error:", error);
        return new Response(
            JSON.stringify({ error: "Failed to fetch maintenance schedule" }),
            { status: 500, headers: { "Content-Type": "application/json" } }
        );
    }
}

// PUT /api/maintenance/[id] - Update a maintenance schedule
export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const session = await getServerSession(authOptions as any) as any;
    if (!session?.user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
        });
    }

    try {
        const { id } = await params;
        const body = await request.json();
        const { title, description, scheduledDate, status, priority, assignedTo, completedDate } = body;

        const schedule = await prisma.maintenanceSchedule.update({
            where: { id },
            data: {
                ...(title !== undefined && { title }),
                ...(description !== undefined && { description }),
                ...(scheduledDate !== undefined && { scheduledDate: new Date(scheduledDate) }),
                ...(status !== undefined && { status }),
                ...(priority !== undefined && { priority }),
                ...(assignedTo !== undefined && { assignedTo }),
                ...(completedDate !== undefined && { completedDate: new Date(completedDate) }),
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

        // If status changed to COMPLETED, update asset status back to ACTIVE
        if (status === "COMPLETED") {
            await prisma.configurationItem.update({
                where: { id: schedule.configurationItemId },
                data: { status: "ACTIVE" },
            });
        }

        return new Response(JSON.stringify(schedule), {
            status: 200,
            headers: { "Content-Type": "application/json" },
        });
    } catch (error) {
        console.error("Maintenance schedule update error:", error);
        return new Response(
            JSON.stringify({ error: "Failed to update maintenance schedule" }),
            { status: 500, headers: { "Content-Type": "application/json" } }
        );
    }
}

// DELETE /api/maintenance/[id] - Delete a maintenance schedule
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const session = await getServerSession(authOptions as any) as any;
    if (!session?.user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
        });
    }

    try {
        const { id } = await params;
        await prisma.maintenanceSchedule.delete({
            where: { id },
        });

        return new Response(JSON.stringify({ success: true }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
        });
    } catch (error) {
        console.error("Maintenance schedule delete error:", error);
        return new Response(
            JSON.stringify({ error: "Failed to delete maintenance schedule" }),
            { status: 500, headers: { "Content-Type": "application/json" } }
        );
    }
}
