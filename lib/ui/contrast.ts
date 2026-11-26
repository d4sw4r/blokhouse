function channel(v: number): number {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

function luminance(hex: string): number {
    const h = hex.replace("#", "");
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** WCAG 2.x contrast ratio between two #RRGGBB colours. */
export function contrastRatio(hexA: string, hexB: string): number {
    const a = luminance(hexA);
    const b = luminance(hexB);
    const [hi, lo] = a >= b ? [a, b] : [b, a];
    return (hi + 0.05) / (lo + 0.05);
}

function parseBlock(css: string, selector: RegExp): Record<string, string> {
    const out: Record<string, string> = {};
    const m = css.match(selector);
    if (!m) return out;
    const re = /--([a-z0-9-]+)\s*:\s*(#[0-9a-fA-F]{6})\s*;/g;
    let t: RegExpExecArray | null;
    while ((t = re.exec(m[1])) !== null) out[t[1]] = t[2];
    return out;
}

/** Reads `--name: #hex;` declarations from the `:root` (light) and `.dark` blocks. */
export function readTokens(css: string): { light: Record<string, string>; dark: Record<string, string> } {
    const stripped = css.replace(/\/\*[\s\S]*?\*\//g, "");
    return {
        light: parseBlock(stripped, /(?:^|\n)\s*:root\s*\{([^}]*)\}/),
        dark: parseBlock(stripped, /(?:^|\n)\s*\.dark\s*\{([^}]*)\}/),
    };
}
