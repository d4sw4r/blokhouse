// lib/sso.js — OIDC sign-in decision: find, link or create the user for an SSO login.
// Called from the NextAuth signIn callback (lib/authOptions.js). Must not import
// lib/auth.js or lib/authOptions.js (circular import).
//
// Returns true to let NextAuth continue (the Account row exists by then, so NextAuth
// signs that user in), or a redirect URL "/signin?error=<Code>" to deny.
import prisma from "./prisma";
import { mapRole } from "./oidc";
import { createAuditLog } from "./audit";

const DAY_MS = 24 * 60 * 60 * 1000;

// Account columns as @next-auth/prisma-adapter's linkAccount stores them.
const ACCOUNT_FIELDS = [
    "type",
    "provider",
    "providerAccountId",
    "refresh_token",
    "access_token",
    "expires_at",
    "token_type",
    "scope",
    "id_token",
    "session_state",
];

const deny = (code) => `/signin?error=${code}`;

function accountData(account) {
    const data = {};
    for (const f of ACCOUNT_FIELDS) {
        if (account[f] !== undefined && account[f] !== null) data[f] = account[f];
    }
    data.provider = "oidc";
    data.providerAccountId = String(account.providerAccountId);
    return data;
}

/** Users whose email matches case-insensitively (at most 2, to detect ambiguity). */
function findByEmail(email) {
    return prisma.user.findMany({
        where: { email: { equals: email, mode: "insensitive" } },
        include: { accounts: { where: { provider: "oidc" }, select: { id: true } } },
        take: 2,
    });
}

function hasRoleMap(config) {
    return config.roleMap.length > 0;
}

function emailLike(v) {
    return typeof v === "string" && v.includes("@") ? v : null;
}

export async function handleOidcSignIn({ account, profile, config }) {
    if (!account || account.provider !== "oidc" || !account.providerAccountId || !profile) {
        return deny("SsoNoAccess");
    }
    const sub = String(account.providerAccountId);
    const claim = profile[config.roleClaim];

    // 1. Known account: identified by sub, never by email.
    const existing = await prisma.account.findUnique({
        where: { provider_providerAccountId: { provider: "oidc", providerAccountId: sub } },
        include: { user: true },
    });
    if (existing) {
        const user = existing.user;
        if (user.disabledAt) return deny("SsoDisabled");
        if (user.role === "API") return deny("SsoServiceAccount");
        if (hasRoleMap(config)) {
            const role = mapRole(config, claim);
            if (!role) return deny("SsoNoAccess");
            if (role !== user.role) {
                await prisma.user.update({ where: { id: user.id }, data: { role } });
                await createAuditLog({
                    action: "USER_UPDATED",
                    entityType: "User",
                    entityId: user.id,
                    userId: user.id,
                    description: `Changed role of ${user.email} from ${user.role} to ${role} via SSO`,
                    oldValues: { role: user.role },
                    newValues: { role },
                });
            }
        }
        return true;
    }

    // 2. Email address (preferred_username only as a fallback for creating a user).
    const email = typeof profile.email === "string" && profile.email.trim() ? profile.email.trim() : null;
    const fallback = emailLike(typeof profile.preferred_username === "string" ? profile.preferred_username.trim() : null);
    if (!email && !fallback) return deny("SsoNoEmail");

    // 3. Role from the directory, before anything is created or linked.
    let mapped = null;
    if (hasRoleMap(config)) {
        mapped = mapRole(config, claim);
        if (!mapped) return deny("SsoNoAccess");
    }

    // 4. Existing user with that email (only the email claim, never the fallback).
    if (email) {
        const matches = await findByEmail(email);
        // Ambiguous (two users differing only in case): never guess which one to link.
        if (matches.length > 1) return deny("SsoEmailNotVerified");
        const user = matches[0];
        if (user) {
            if (user.disabledAt) return deny("SsoDisabled");
            if (user.role === "API") return deny("SsoServiceAccount");
            if (user.role === "ADMIN" && user.password) return deny("SsoLocalAdmin");
            if (profile.email_verified !== true && !config.trustEmail) return deny("SsoEmailNotVerified");
            // Already linked to a different SSO identity: a second sub must not take it over.
            if (user.accounts.length > 0) return deny("SsoEmailNotVerified");

            const cap = new Date(Date.now() + config.tokenMaxDays * DAY_MS);
            const data = { password: null, ...(mapped && { role: mapped }) };
            const [, , capped] = await prisma.$transaction([
                prisma.account.create({ data: { ...accountData(account), userId: user.id } }),
                prisma.user.update({ where: { id: user.id }, data }),
                prisma.apiToken.updateMany({
                    where: { userId: user.id, OR: [{ expiresAt: null }, { expiresAt: { gt: cap } }] },
                    data: { expiresAt: cap },
                }),
            ]);
            await createAuditLog({
                action: "USER_UPDATED",
                entityType: "User",
                entityId: user.id,
                userId: user.id,
                description:
                    `Linked SSO account for ${user.email} via SSO (password removed` +
                    (mapped && mapped !== user.role ? `, role ${user.role} -> ${mapped}` : "") +
                    (capped.count ? `, ${capped.count} API token(s) capped to ${config.tokenMaxDays} days` : "") +
                    ")",
                oldValues: { role: user.role, hadPassword: !!user.password },
                newValues: { role: mapped ?? user.role, hadPassword: false, sub },
            });
            return true;
        }
    } else {
        // 5a. Only preferred_username: if that address already belongs to someone, never link.
        const matches = await findByEmail(fallback);
        if (matches.length > 0) return deny("SsoEmailNotVerified");
    }

    // 5. New user.
    const name =
        (typeof profile.name === "string" && profile.name.trim()) ||
        (typeof profile.preferred_username === "string" && profile.preferred_username.trim()) ||
        null;
    const role = mapped ?? config.defaultRole;
    const created = await prisma.$transaction(async (tx) => {
        const user = await tx.user.create({ data: { name, email: email ?? fallback, role } });
        await tx.account.create({ data: { ...accountData(account), userId: user.id } });
        return user;
    });
    await createAuditLog({
        action: "USER_CREATED",
        entityType: "User",
        entityId: created.id,
        userId: created.id,
        description: `Created user ${created.email} with role ${role} via SSO`,
        newValues: { id: created.id, name: created.name, email: created.email, role, sub },
    });
    return true;
}
