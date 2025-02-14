// app/api/auth/signup/route.js
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function POST(request) {
    try {
        const { name, email, password } = await request.json();

        // Check if user exists
        const existingUser = await prisma.user.findUnique({ where: { email } });
        if (existingUser) {
            return new Response(JSON.stringify({ error: "User already exists" }), { status: 400 });
        }

        // Generate salt and hash password
        const salt = bcrypt.genSaltSync(10);
        const hashedPassword = bcrypt.hashSync(password, salt);

        // Create the user with a default role (USER by default)
        const user = await prisma.user.create({
            data: {
                name,
                email,
                password: hashedPassword,
                emailVerified: new Date(),
                role: "USER", // or set a role from the request if needed
            },
        });

        return new Response(JSON.stringify({ message: "User created successfully", user }), { status: 201 });
    } catch (error) {
        console.error("Signup error:", error);
        return new Response(JSON.stringify({ error: "Signup failed" }), { status: 500 });
    }
}
