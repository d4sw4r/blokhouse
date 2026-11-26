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

// Tinted components: text (and secondary text) on (tone at TINT alpha over bg, surface and
// surface-2), both themes. Keep in sync with components/ui/Badge.tsx and components/ui/Callout.tsx.
const TINT = 0.1;
const BADGE_TEXT = { neutral: "text", accent: "text", success: "text", warning: "text", danger: "text" };
const CALLOUT_TEXT = { danger: ["text", "text-muted"], success: ["text", "text-muted"], warning: ["text", "text-muted"], accent: ["text", "text-muted"] };
const SURFACES = ["bg", "surface", "surface-2"];

function composite(fg, bg, alpha) {
    const ch = (h, i) => parseInt(h.slice(1 + i * 2, 3 + i * 2), 16);
    return (
        "#" +
        [0, 1, 2]
            .map((i) => Math.round(ch(fg, i) * alpha + ch(bg, i) * (1 - alpha)).toString(16).padStart(2, "0"))
            .join("")
    );
}

describe("tint table matches the components", () => {
    it("Badge and Callout use text-text on every tone", () => {
        const badge = readFileSync(path.resolve(__dirname, "../../components/ui/Badge.tsx"), "utf8");
        const callout = readFileSync(path.resolve(__dirname, "../../components/ui/Callout.tsx"), "utf8");
        for (const tone of Object.keys(BADGE_TEXT)) {
            expect(badge, `Badge ${tone}`).toMatch(new RegExp(`${tone}: "bg-${tone}/10 text-text `));
        }
        expect(callout).toMatch(/text-sm text-text/);
        for (const tone of Object.keys(CALLOUT_TEXT)) {
            expect(callout, `Callout ${tone}`).toMatch(new RegExp(`bg-${tone}/10"`));
        }
    });
});

for (const theme of ["light", "dark"]) {
    describe(`${theme} tint contrast`, () => {
        const t = tokens[theme];
        for (const surface of SURFACES) {
            for (const [tone, textToken] of Object.entries(BADGE_TEXT)) {
                it(`Badge ${tone}: ${textToken} on ${TINT} tint over ${surface} is >= 4.5`, () => {
                    const bg = composite(t[tone], t[surface], TINT);
                    const r = contrastRatio(t[textToken], bg);
                    expect(r, `${theme}/${tone}/${surface} ${r.toFixed(2)}`).toBeGreaterThanOrEqual(4.5);
                });
            }
            for (const [tone, textTokens] of Object.entries(CALLOUT_TEXT)) {
                it(`Callout ${tone}: text >= 4.5 and icon >= 3 on ${TINT} tint over ${surface}`, () => {
                    const bg = composite(t[tone], t[surface], TINT);
                    for (const textToken of textTokens) {
                        const r = contrastRatio(t[textToken], bg);
                        expect(r, `${theme}/${tone}/${surface}/${textToken} ${r.toFixed(2)}`).toBeGreaterThanOrEqual(4.5);
                    }
                    const icon = contrastRatio(t[tone], bg);
                    expect(icon, `${theme}/${tone}/${surface} icon ${icon.toFixed(2)}`).toBeGreaterThanOrEqual(3);
                });
            }
        }
    });
}

// Badge borders are UI boundaries: the border colour (tone at its border alpha) over the badge's
// own tint must reach 3:1 on bg, surface and surface-2. Keep in sync with components/ui/Badge.tsx.
describe("Badge borders", () => {
    const badge = readFileSync(path.resolve(__dirname, "../../components/ui/Badge.tsx"), "utf8");
    for (const theme of ["light", "dark"]) {
        const t = tokens[theme];
        for (const tone of Object.keys(BADGE_TEXT)) {
            const m = badge.match(new RegExp(`${tone}: "bg-${tone}/10 text-text border-${tone}(?:/(\\d+))?"`));
            for (const surface of SURFACES) {
                it(`${theme}/${tone}: border over its tint on ${surface} is >= 3`, () => {
                    expect(m, `Badge ${tone} border class`).not.toBeNull();
                    const alpha = m[1] ? Number(m[1]) / 100 : 1;
                    const fill = composite(t[tone], t[surface], TINT);
                    // The border is painted over the badge's own background (background-clip: border-box).
                    const border = composite(t[tone], fill, alpha);
                    const r = contrastRatio(border, t[surface]);
                    expect(r, `${theme}/${tone}/${surface} border ${r.toFixed(2)}`).toBeGreaterThanOrEqual(3);
                });
            }
        }
    }
});
