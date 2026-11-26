// lib/users.js — shared helpers for user management
import bcrypt from "bcryptjs";
import { passwordLoginEnabled, getOidcConfig } from "./oidc";

export const USER_SELECT = { id: true, name: true, email: true, role: true, disabledAt: true };
// Same as USER_SELECT plus whether the user has an OIDC identity (one query, no per-user lookups).
export const USER_SELECT_SSO = {
    ...USER_SELECT,
    accounts: { where: { provider: "oidc" }, select: { id: true }, take: 1 },
};
export const MIN_PASSWORD_LENGTH = 8;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(email) {
    return typeof email === "string" && email.length <= 254 && EMAIL_RE.test(email);
}

export function passwordProblem(password) {
    if (typeof password !== "string" || password.length < MIN_PASSWORD_LENGTH) {
        return `Password must be at least ${MIN_PASSWORD_LENGTH} characters`;
    }
    if (password.length > 200) return "Password is too long";
    return null;
}

export function hashPassword(password) {
    return bcrypt.hashSync(password, bcrypt.genSaltSync(12));
}

/** Public self-registration is disabled unless ALLOW_SIGNUP=true, and always when PASSWORD_LOGIN=false. */
export function signupEnabled() {
    if (!passwordLoginEnabled()) return false;
    return String(process.env.ALLOW_SIGNUP || "").toLowerCase() === "true";
}

/** Strip the accounts relation from a USER_SELECT_SSO row and add `sso` / `roleManagedBySso`. */
export function withSso(user) {
    if (!user) return user;
    const { accounts, ...rest } = user;
    const sso = Array.isArray(accounts) && accounts.length > 0;
    const config = getOidcConfig();
    return { ...rest, sso, roleManagedBySso: sso && !!config && config.roleMap.length > 0 };
}
