// lib/users.js — shared helpers for user management
import bcrypt from "bcryptjs";

export const USER_SELECT = { id: true, name: true, email: true, role: true };
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

/** Public self-registration is disabled unless ALLOW_SIGNUP=true. */
export function signupEnabled() {
    return String(process.env.ALLOW_SIGNUP || "").toLowerCase() === "true";
}
