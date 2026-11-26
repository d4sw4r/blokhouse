// app/api/users/[id]/route.js — user management (admin only)
import prisma from "@/lib/prisma";
import { requireAuth, isValidRole, ROLES, jsonError } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";
import { USER_SELECT, isValidEmail, passwordProblem, hashPassword } from "@/lib/users";

async function countOtherAdmins(id) {
    return prisma.user.count({ where: { role: "ADMIN", disabledAt: null, NOT: { id } } });
}

export async function GET(request, { params }) {
    const { response } = await requireAuth(request, "admin");
    if (response) return response;
    const { id } = await params;
    const user = await prisma.user.findUnique({ where: { id }, select: USER_SELECT });
    if (!user) return jsonError(404, "Not found");
    return new Response(JSON.stringify(user), { status: 200 });
}

export async function PUT(request, { params }) {
    const { auth, response } = await requireAuth(request, "admin");
    if (response) return response;
    const { id } = await params;
    const { name, email, role, password, disabled } = await request.json();

    const data = {};
    if (name !== undefined) data.name = name;
    if (email !== undefined) {
        if (!isValidEmail(email)) return jsonError(400, "A valid email is required");
        data.email = email;
    }
    if (role !== undefined) {
        if (!isValidRole(role)) return jsonError(400, `Role must be one of: ${ROLES.join(", ")}`);
        data.role = role;
    }
    if (disabled !== undefined) {
        if (typeof disabled !== "boolean") return jsonError(400, "disabled must be a boolean");
        if (disabled && id === auth.user.id) return jsonError(400, "You cannot deactivate your own account");
    }
    if (password !== undefined && password !== "") {
        const pwError = passwordProblem(password);
        if (pwError) return jsonError(400, pwError);
        data.password = hashPassword(password);
    }

    const existing = await prisma.user.findUnique({ where: { id }, select: USER_SELECT });
    if (!existing) return jsonError(404, "Not found");
    if (existing.role === "ADMIN" && data.role && data.role !== "ADMIN" && (await countOtherAdmins(id)) === 0) {
        return jsonError(400, "Cannot demote the last administrator");
    }
    if (disabled === true && !existing.disabledAt) {
        if (existing.role === "ADMIN" && (await countOtherAdmins(id)) === 0) {
            return jsonError(400, "Cannot deactivate the last administrator");
        }
        data.disabledAt = new Date();
    } else if (disabled === false) {
        data.disabledAt = null;
    }

    const deactivationNote =
        disabled === true && !existing.disabledAt ? " (deactivated)" : disabled === false && existing.disabledAt ? " (reactivated)" : "";

    try {
        const updated = await prisma.user.update({ where: { id }, data, select: USER_SELECT });
        await createAuditLog({
            action: "USER_UPDATED",
            entityType: "User",
            entityId: id,
            userId: auth.user.id,
            description: `Updated user ${updated.email}${data.password ? " (password changed)" : ""}${deactivationNote}`,
            oldValues: existing,
            newValues: updated,
            req: request,
        });
        return new Response(JSON.stringify(updated), { status: 200 });
    } catch (error) {
        console.error("Update user error:", error);
        return jsonError(500, "Update failed");
    }
}

export async function DELETE(request, { params }) {
    const { auth, response } = await requireAuth(request, "admin");
    if (response) return response;
    const { id } = await params;

    if (id === auth.user.id) return jsonError(400, "You cannot delete your own account");
    const existing = await prisma.user.findUnique({ where: { id }, select: USER_SELECT });
    if (!existing) return jsonError(404, "Not found");
    if (existing.role === "ADMIN" && (await countOtherAdmins(id)) === 0) {
        return jsonError(400, "Cannot delete the last administrator");
    }

    try {
        await prisma.user.delete({ where: { id } });
        await createAuditLog({
            action: "USER_DELETED",
            entityType: "User",
            entityId: id,
            userId: auth.user.id,
            description: `Deleted user ${existing.email}`,
            oldValues: existing,
            req: request,
        });
        return new Response(JSON.stringify({ message: "Deleted" }), { status: 200 });
    } catch (error) {
        console.error("Delete user error:", error);
        return jsonError(500, "Delete failed");
    }
}
