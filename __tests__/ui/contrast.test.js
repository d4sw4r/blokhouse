import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import path from "path";
import { contrastRatio, readTokens } from "@/lib/ui/contrast";

const css = readFileSync(path.resolve(__dirname, "../../app/globals.css"), "utf8");
const tokens = readTokens(css);

describe("contrastRatio", () => {
    it("black on white is 21", () => {
        expect(contrastRatio("#000000", "#FFFFFF")).toBeCloseTo(21, 1);
    });
    it("identical colours give 1", () => {
        expect(contrastRatio("#777777", "#777777")).toBe(1);
    });
});

for (const theme of ["light", "dark"]) {
    describe(`${theme} tokens`, () => {
        const t = tokens[theme];
        it("defines all tokens", () => {
            for (const k of ["bg", "surface", "surface-2", "border", "border-strong", "text", "text-muted", "accent", "accent-fg", "success", "warning", "danger", "neutral"]) {
                expect(t[k], k).toMatch(/^#[0-9a-fA-F]{6}$/);
            }
        });
        it("text contrast >= 4.5", () => {
            for (const fg of ["text", "text-muted"]) {
                for (const bg of ["bg", "surface"]) {
                    expect(contrastRatio(t[fg], t[bg]), `${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5);
                }
            }
            expect(contrastRatio(t["accent-fg"], t.accent)).toBeGreaterThanOrEqual(4.5);
        });
        it("status and accent colours >= 3 on bg and surface", () => {
            for (const c of ["success", "warning", "danger", "neutral", "accent"]) {
                for (const bg of ["bg", "surface"]) {
                    expect(contrastRatio(t[c], t[bg]), `${c} on ${bg}`).toBeGreaterThanOrEqual(3);
                }
            }
        });
        it("border-strong on surface >= 3", () => {
            expect(contrastRatio(t["border-strong"], t.surface)).toBeGreaterThanOrEqual(3);
        });
    });
}
