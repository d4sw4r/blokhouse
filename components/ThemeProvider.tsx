"use client";

import { createContext, useCallback, useContext, useEffect, useState, useMemo, ReactNode } from "react";
import { THEME_KEY, readThemeChoice, resolveTheme, type ThemeChoice } from "@/lib/ui/theme";

interface ThemeContextType {
    theme: ThemeChoice;
    setTheme: (theme: ThemeChoice) => void;
    resolvedTheme: "light" | "dark";
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
    const [theme, setThemeState] = useState<ThemeChoice>(() => {
        if (typeof window === "undefined") return "dark";
        try {
            return readThemeChoice(localStorage.getItem(THEME_KEY));
        } catch {
            return "dark";
        }
    });

    const [systemDark, setSystemDark] = useState<boolean>(() => {
        if (typeof window === "undefined") return false;
        return window.matchMedia("(prefers-color-scheme: dark)").matches;
    });

    const resolvedTheme = useMemo(() => resolveTheme(theme, systemDark), [theme, systemDark]);

    // Apply the class (the init script already did on load; this handles later changes). Never writes storage.
    useEffect(() => {
        const root = document.documentElement;
        root.classList.remove("light", "dark");
        root.classList.add(resolvedTheme);
    }, [resolvedTheme]);

    // Follow OS changes only while "system" is chosen
    useEffect(() => {
        if (theme !== "system") return;
        const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
        const handleChange = (e: MediaQueryListEvent) => setSystemDark(e.matches);
        mediaQuery.addEventListener("change", handleChange);
        return () => mediaQuery.removeEventListener("change", handleChange);
    }, [theme]);

    // The only writer of THEME_KEY
    const setTheme = useCallback((next: ThemeChoice) => {
        setThemeState(next);
        try {
            localStorage.setItem(THEME_KEY, next);
        } catch {}
    }, []);

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
