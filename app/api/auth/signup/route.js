// app/api/auth/signup/route.js
import prisma from "@/lib/prisma";

export async function POST(request) {
    try {
        const { name, email, password } = await request.json();

        // Check if a user with the provided email already exists
        const existingUser = await prisma.user.findUnique({
            where: { email },
        });

        if (existingUser) {
            return new Response(
                JSON.stringify({ error: "User already exists" }),
                { status: 400 }
            );
        }

        // Create the user (plain-text password for demo only)
        const user = await prisma.user.create({
            data: {
                name,
                email,
                password,
                emailVerified: new Date(), // Optionally mark as verified
            },
        });

        return new Response(
            JSON.stringify({ message: "User created successfully", user }),
            { status: 201 }
        );
    } catch (error) {
        console.error("Signup error:", error);
        return new Response(
            JSON.stringify({ error: "Signup failed" }),
            { status: 500 }
        );
    }
}
