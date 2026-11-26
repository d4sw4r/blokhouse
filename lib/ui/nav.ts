export type Role = "ADMIN" | "USER" | "API" | "AUDIT" | "READONLY";

export type NavEntry = { label: string; href: string; roles?: Role[] };
export type NavGroup = { label: string; href?: string; entries: NavEntry[] };
export type NavLinkItem = { label: string; href: string };
export type NavMenuItem = { label: string; entries: NavEntry[] };
export type NavItem = NavLinkItem | NavMenuItem;

const ADMIN_ONLY: Role[] = ["ADMIN"];

export const NAV: NavGroup[] = [
    { label: "Overview", entries: [{ label: "Overview", href: "/dashboard" }] },
    {
        label: "Inventory",
        entries: [
            { label: "Items", href: "/items" },
            { label: "Tags", href: "/tags" },
            { label: "Compare", href: "/compare" },
            { label: "Maintenance", href: "/maintenance" },
        ],
    },
    { label: "Topology", entries: [{ label: "Graph", href: "/graph" }] },
    {
        label: "Model",
        entries: [
            { label: "Types", href: "/types" },
            { label: "Custom fields", href: "/admin/custom-fields", roles: ADMIN_ONLY },
        ],
    },
    {
        label: "Automation",
        entries: [
            { label: "Discovery", href: "/discovery" },
            { label: "Webhooks", href: "/admin/webhooks", roles: ADMIN_ONLY },
            { label: "API tokens", href: "/admin/api" },
        ],
    },
    { label: "Reports", entries: [{ label: "Reports", href: "/reports" }] },
    {
        label: "Admin",
        entries: [
            { label: "Overview", href: "/admin", roles: ADMIN_ONLY },
            { label: "Users", href: "/admin/users", roles: ADMIN_ONLY },
            { label: "Audit log", href: "/admin/audit-logs", roles: ["ADMIN", "AUDIT"] },
            { label: "Settings", href: "/admin/settings", roles: ADMIN_ONLY },
        ],
    },
];

const SIGNED_IN: Role[] = ["ADMIN", "USER", "AUDIT", "READONLY"];

export function navForRole(role: string): NavItem[] {
    if (!SIGNED_IN.includes(role as Role)) return [];
    const out: NavItem[] = [];
    for (const group of NAV) {
        const entries = group.entries.filter((e) => !e.roles || e.roles.includes(role as Role));
        if (entries.length === 0) continue;
        if (entries.length === 1) out.push({ label: group.label, href: entries[0].href });
        else out.push({ label: group.label, entries });
    }
    return out;
}

export function isMenu(item: NavItem): item is NavMenuItem {
    return "entries" in item;
}

/** Entry is active on its exact path or any sub-path; "/admin" matches only exactly. */
export function isActiveHref(pathname: string | null, href: string): boolean {
    if (!pathname) return false;
    if (pathname === href) return true;
    if (href === "/admin") return false;
    return pathname.startsWith(href + "/");
}

export function isItemActive(pathname: string | null, item: NavItem): boolean {
    return isMenu(item) ? item.entries.some((e) => isActiveHref(pathname, e.href)) : isActiveHref(pathname, item.href);
}
