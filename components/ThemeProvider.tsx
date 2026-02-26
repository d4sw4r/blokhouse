"use client";

import { createContext, useContext, useEffect, useState, useMemo, ReactNode } from "react";

type Theme = "light" | "dark" | "system";

interface ThemeContextType {
    theme: Theme;
    setTheme: (theme: Theme) => void;
    resolvedTheme: "light" | "dark";
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
    // Lazy-initialize from localStorage — no setState in effect needed
    const [theme, setTheme] = useState<Theme>(() => {
        if (typeof window === "undefined") return "system";
        return (localStorage.getItem("theme") as Theme) || "system";
    });

    // Lazy-initialize from matchMedia — updated only inside event listener callback
    const [systemDark, setSystemDark] = useState<boolean>(() => {
        if (typeof window === "undefined") return false;
        return window.matchMedia("(prefers-color-scheme: dark)").matches;
    });

    // Derived — no state needed
    const resolvedTheme = useMemo((): "light" | "dark" => {
        if (theme !== "system") return theme;
        return systemDark ? "dark" : "light";
    }, [theme, systemDark]);

    // Apply theme to <html> — useEffect is client-only, no SSR guard needed
    useEffect(() => {
        const root = document.documentElement;
        root.classList.remove("light", "dark");
        root.classList.add(resolvedTheme);
        localStorage.setItem("theme", theme);
    }, [resolvedTheme, theme]);

    // Listen for system preference changes — setState only inside the callback
    useEffect(() => {
        if (theme !== "system") return;
        const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
        const handleChange = (e: MediaQueryListEvent) => setSystemDark(e.matches);
        mediaQuery.addEventListener("change", handleChange);
        return () => mediaQuery.removeEventListener("change", handleChange);
    }, [theme]);

    return (
        <ThemeContext.Provider value={{ theme, setTheme, resolvedTheme }}>
            {children}
        </ThemeContext.Provider>
    );
}

export function useTheme() {
    const context = useContext(ThemeContext);
    if (context === undefined) {
        throw new Error("useTheme must be used within a ThemeProvider");
    }
    return context;
}
