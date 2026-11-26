import { describe, it, expect } from "vitest";
import { NAV, navForRole } from "@/lib/ui/nav";

const labels = (arr) => arr.map((g) => g.label);
const find = (role, label) => navForRole(role).find((g) => g.label === label);

describe("navForRole", () => {
    it("ADMIN sees every group", () => {
        expect(labels(navForRole("ADMIN"))).toEqual(["Overview", "Inventory", "Topology", "Model", "Automation", "Reports", "Admin"]);
        expect(find("ADMIN", "Inventory").entries.map((e) => e.label)).toEqual(["Items", "Tags", "Compare", "Maintenance"]);
        expect(find("ADMIN", "Admin").entries.map((e) => e.label)).toEqual(["Overview", "Users", "Audit log", "Settings"]);
    });

    it("READONLY has no admin group and limited entries", () => {
        const nav = navForRole("READONLY");
        expect(labels(nav)).not.toContain("Admin");
        expect(find("READONLY", "Model")).toEqual({ label: "Model", href: "/types" });
        expect(find("READONLY", "Automation").entries.map((e) => e.label)).toEqual(["Discovery", "API tokens"]);
        const hrefs = nav.flatMap((g) => (g.entries ? g.entries.map((e) => e.href) : [g.href]));
        expect(hrefs.filter((h) => h.startsWith("/admin") && h !== "/admin/api")).toEqual([]);
    });

    it("AUDIT gets Admin as a plain link to the audit log", () => {
        expect(find("AUDIT", "Admin")).toEqual({ label: "Admin", href: "/admin/audit-logs" });
    });

    it("API and unknown roles get nothing", () => {
        expect(navForRole("API")).toEqual([]);
        expect(navForRole("")).toEqual([]);
    });

    it("every NAV href starts with /", () => {
        for (const g of NAV) {
            if (g.href) expect(g.href.startsWith("/")).toBe(true);
            for (const e of g.entries) expect(e.href.startsWith("/")).toBe(true);
        }
    });
});
