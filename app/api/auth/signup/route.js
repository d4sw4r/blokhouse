// app/api/auth/signup/route.js
// Public self-registration. Disabled by default; enable with ALLOW_SIGNUP=true.
// New accounts always get the READONLY role — an admin must promote them.
import prisma from "@/lib/prisma";
import { jsonError } from "@/lib/auth";
import { USER_SELECT, isValidEmail, passwordProblem, hashPassword, signupEnabled } from "@/lib/users";

export async function GET() {
    return new Response(JSON.stringify({ enabled: signupEnabled() }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
    });
}

export async function POST(request) {
    if (!signupEnabled()) {
        return jsonError(403, "Self-registration is disabled. Ask an administrator for an account.");
    }
    try {
        const { name, email, password } = await request.json();

        if (!isValidEmail(email)) return jsonError(400, "A valid email is required");
        const pwError = passwordProblem(password);
        if (pwError) return jsonError(400, pwError);

        const existingUser = await prisma.user.findUnique({ where: { email } });
        if (existingUser) {
            return jsonError(400, "User already exists");
        }

        const user = await prisma.user.create({
            data: {
                name: typeof name === "string" ? name.slice(0, 100) : null,
                email,
                password: hashPassword(password),
                emailVerified: new Date(),
                role: "READONLY",
            },
            select: USER_SELECT,
        });

        return new Response(JSON.stringify({ message: "User created successfully", user }), {
            status: 201,
            headers: { "Content-Type": "application/json" },
        });
    } catch (error) {
        console.error("Signup error:", error);
        return jsonError(500, "Signup failed");
    }
}
