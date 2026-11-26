export const THEME_KEY = "blokhouse-theme";

export type ThemeChoice = "dark" | "light" | "system";

export function readThemeChoice(value: string | null): ThemeChoice {
    return value === "dark" || value === "light" || value === "system" ? value : "dark";
}

export function resolveTheme(choice: ThemeChoice, systemDark: boolean): "dark" | "light" {
    if (choice === "system") return systemDark ? "dark" : "light";
    return choice;
}

/** Inline script source that applies the theme class before first paint. Read-only. */
export function themeInitScript(): string {
    return `(function(){var t="dark";try{var v=localStorage.getItem(${JSON.stringify(THEME_KEY)});if(v==="light"||v==="dark")t=v;else if(v==="system")t=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";}catch(e){}try{var c=document.documentElement.classList;c.remove("light","dark");c.add(t);}catch(e){}})();`;
}
