// app/api/users/route.js — user management (admin only)
import prisma from "@/lib/prisma";
import { requireAuth, isValidRole, ROLES, jsonError } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";
import { USER_SELECT, isValidEmail, passwordProblem, hashPassword } from "@/lib/users";

export async function GET(request) {
    const { response } = await requireAuth(request, "admin");
    if (response) return response;
    const users = await prisma.user.findMany({ select: USER_SELECT });
    return new Response(JSON.stringify(users), { status: 200 });
}

export async function POST(request) {
    const { auth, response } = await requireAuth(request, "admin");
    if (response) return response;

    const { name, email, password, role = "USER" } = await request.json();
    if (!isValidEmail(email)) return jsonError(400, "A valid email is required");
    const pwError = passwordProblem(password);
    if (pwError) return jsonError(400, pwError);
    if (!isValidRole(role)) return jsonError(400, `Role must be one of: ${ROLES.join(", ")}`);

    try {
        const user = await prisma.user.create({
            data: {
                name,
                email,
                password: hashPassword(password),
                emailVerified: new Date(),
                role,
            },
            select: USER_SELECT,
        });
        await createAuditLog({
            action: "USER_CREATED",
            entityType: "User",
            entityId: user.id,
            userId: auth.user.id,
            description: `Created user ${user.email} with role ${user.role}`,
            newValues: user,
            req: request,
        });
        return new Response(JSON.stringify(user), { status: 201 });
    } catch (error) {
        console.error("Create user error:", error);
        return jsonError(500, "Could not create user");
    }
}
