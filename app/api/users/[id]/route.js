// app/api/users/[id]/route.js — user management (admin only)
import prisma from "@/lib/prisma";
import { requireAuth, isValidRole, ROLES, jsonError } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";
import { getOidcConfig } from "@/lib/oidc";
import { USER_SELECT, USER_SELECT_SSO, withSso, isValidEmail, passwordProblem, hashPassword } from "@/lib/users";

async function countOtherAdmins(id) {
    return prisma.user.count({ where: { role: "ADMIN", disabledAt: null, NOT: { id } } });
}

// Active ADMIN with a password and no OIDC identity: can sign in when the identity provider is down.
const LOCAL_ADMIN_WHERE = { role: "ADMIN", disabledAt: null, password: { not: null }, accounts: { none: { provider: "oidc" } } };
const BREAK_GLASS_ERROR = "Keep at least one local administrator with a password for break-glass access";

/** True when removing user `id` from the admins would leave no local admin while OIDC is configured. */
async function isLastLocalAdmin(id) {
    if (!getOidcConfig()) return false;
    const isLocal = (await prisma.user.count({ where: { ...LOCAL_ADMIN_WHERE, id } })) > 0;
    if (!isLocal) return false;
    return (await prisma.user.count({ where: { ...LOCAL_ADMIN_WHERE, NOT: { id } } })) === 0;
}

export async function GET(request, { params }) {
    const { response } = await requireAuth(request, "admin");
    if (response) return response;
    const { id } = await params;
    const user = await prisma.user.findUnique({ where: { id }, select: USER_SELECT_SSO });
    if (!user) return jsonError(404, "Not found");
    return new Response(JSON.stringify(withSso(user)), { status: 200 });
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

    const found = await prisma.user.findUnique({ where: { id }, select: USER_SELECT_SSO });
    if (!found) return jsonError(404, "Not found");
    const { sso, roleManagedBySso, ...existing } = withSso(found);
    if (data.role !== undefined && data.role !== existing.role && roleManagedBySso) {
        return jsonError(409, "The role of this user is managed by the identity provider (OIDC_ROLE_MAP)");
    }
    if (data.password && sso && getOidcConfig()) {
        return jsonError(409, "This user signs in via single sign-on and cannot have a password");
    }
    if (existing.role === "ADMIN" && data.role && data.role !== "ADMIN" && (await countOtherAdmins(id)) === 0) {
        return jsonError(400, "Cannot demote the last administrator");
    }
    if (existing.role === "ADMIN" && data.role && data.role !== "ADMIN" && (await isLastLocalAdmin(id))) {
        return jsonError(400, BREAK_GLASS_ERROR);
    }
    if (disabled === true && !existing.disabledAt) {
        if (existing.role === "ADMIN" && (await countOtherAdmins(id)) === 0) {
            return jsonError(400, "Cannot deactivate the last administrator");
        }
        if (await isLastLocalAdmin(id)) return jsonError(400, BREAK_GLASS_ERROR);
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
        return new Response(JSON.stringify({ ...updated, sso, roleManagedBySso }), { status: 200 });
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
    if (await isLastLocalAdmin(id)) return jsonError(400, BREAK_GLASS_ERROR);

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
