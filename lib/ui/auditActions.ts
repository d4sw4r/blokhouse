import { humanize, type Tone } from "./tone";

/** Audit log action -> badge tone and label. One scheme for every page that shows actions. */
const actions: Record<string, { tone: Tone; label: string }> = {
    CREATE: { tone: "success", label: "Created" },
    UPDATE: { tone: "accent", label: "Updated" },
    DELETE: { tone: "danger", label: "Deleted" },
    LOGIN: { tone: "success", label: "Login" },
    LOGOUT: { tone: "neutral", label: "Logout" },
    API_TOKEN_CREATED: { tone: "success", label: "API Token Created" },
    API_TOKEN_DELETED: { tone: "neutral", label: "API Token Deleted" },
};

export const AUDIT_ACTIONS = Object.keys(actions);

export function auditAction(action: string): { tone: Tone; label: string } {
    return actions[action] ?? { tone: "neutral", label: humanize(action) };
}
