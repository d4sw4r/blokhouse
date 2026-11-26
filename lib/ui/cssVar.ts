/** Reads a computed CSS custom property (trimmed). Defaults to <html>, where the theme tokens live. */
export function cssVar(name: string, el?: Element): string {
    if (typeof document === "undefined") return "";
    const target = el ?? document.documentElement;
    return getComputedStyle(target).getPropertyValue(name).trim();
}
