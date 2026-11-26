import { describe, it, expect } from "vitest";
import { readThemeChoice, resolveTheme, themeInitScript, THEME_KEY } from "@/lib/ui/theme";

function run(stored, systemDark = false) {
    const added = [];
    const removed = [];
    const localStorage = { getItem: (k) => (k in stored ? stored[k] : null) };
    const matchMedia = () => ({ matches: systemDark });
    const document = {
        documentElement: {
            classList: { add: (c) => added.push(c), remove: (...c) => removed.push(...c) },
        },
    };
    new Function("localStorage", "matchMedia", "document", themeInitScript())(localStorage, matchMedia, document);
    return { added, removed };
}

describe("theme helpers", () => {
    it("reads choice with dark fallback", () => {
        expect(THEME_KEY).toBe("blokhouse-theme");
        expect(readThemeChoice(null)).toBe("dark");
        expect(readThemeChoice("bogus")).toBe("dark");
        expect(readThemeChoice("light")).toBe("light");
        expect(readThemeChoice("system")).toBe("system");
    });
    it("resolves theme", () => {
        expect(resolveTheme("system", true)).toBe("dark");
        expect(resolveTheme("system", false)).toBe("light");
        expect(resolveTheme("light", true)).toBe("light");
        expect(resolveTheme("dark", false)).toBe("dark");
    });
});

describe("themeInitScript", () => {
    it("uses the key and never writes", () => {
        const s = themeInitScript();
        expect(s).toContain("blokhouse-theme");
        expect(s).not.toContain("localStorage.setItem");
    });
    it("defaults to dark", () => {
        expect(run({}).added).toEqual(["dark"]);
    });
    it("applies stored light", () => {
        expect(run({ "blokhouse-theme": "light" }).added).toEqual(["light"]);
    });
    it("ignores the old key", () => {
        expect(run({ theme: "system" }, false).added).toEqual(["dark"]);
    });
    it("resolves system via matchMedia", () => {
        expect(run({ "blokhouse-theme": "system" }, false).added).toEqual(["light"]);
        expect(run({ "blokhouse-theme": "system" }, true).added).toEqual(["dark"]);
    });
});
