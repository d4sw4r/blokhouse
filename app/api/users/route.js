// app/api/users/route.js
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import authOptions from "@/lib/authOptions";

export async function GET() {
    const session = await getServerSession(authOptions);
    if (!session) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }
    // Return all users (select only safe fields)
    const users = await prisma.user.findMany({
        select: { id: true, name: true, email: true }
    });
    return new Response(JSON.stringify(users), { status: 200 });
}

export async function POST(request) {
    const session = await getServerSession(authOptions);
    if (!session) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }
    const { name, email, password } = await request.json();
    try {
        const user = await prisma.user.create({
            data: {
                name,
                email,
                password, // Demo purposes only; hash in production!
                emailVerified: new Date(),
            },
            select: { id: true, name: true, email: true }
        });
        return new Response(JSON.stringify(user), { status: 201 });
    } catch (error) {
        console.error("Create user error:", error);
        return new Response(JSON.stringify({ error: "Could not create user" }), { status: 500 });
    }
}
