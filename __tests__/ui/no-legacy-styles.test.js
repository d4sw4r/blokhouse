import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(__dirname, "../..");
const dirs = ["app", "components", "lib"];
const exts = /\.(tsx|jsx|ts|js)$/;

function walk(dir, out = []) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) walk(p, out);
        else if (exts.test(e.name)) out.push(p);
    }
    return out;
}

const palette =
    "white|black|gray|slate|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose";
const patterns = [
    /\bbrand-/,
    new RegExp(`\\b(?:bg|text|border|ring|from|to|via)-(?:${palette})(?:-\\d{2,3})?\\b`),
    /variant="outline"/,
    /variant="destructive"/,
    /size="lg"/,
    /from "three"/,
];

// `neutral` is both a Tailwind palette name and our semantic status token
// (bg-neutral, border-neutral/40 ...). The token utilities are legitimate and
// stripped before matching; every other palette class still fails.
const semanticNeutral = /\b(?:bg|text|border|ring)-neutral(?:\/\d+)?(?![\w-])/g;
const read = (f) => fs.readFileSync(f, "utf8").replace(semanticNeutral, "");

describe("no legacy styles", () => {
    const files = dirs.flatMap((d) => walk(path.join(root, d)));
    for (const re of patterns) {
        it(`has no match for ${re}`, () => {
            const hits = files.filter((f) => re.test(read(f))).map((f) => path.relative(root, f));
            expect(hits).toEqual([]);
        });
    }
});
