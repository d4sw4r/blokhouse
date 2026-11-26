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
    // Start SSR-consistent ("dark"); the real values are read after mount to avoid hydration mismatch.
    const [theme, setThemeState] = useState<ThemeChoice>("dark");
    const [systemDark, setSystemDark] = useState<boolean>(false);
    const [synced, setSynced] = useState(false);

    useEffect(() => {
        let stored: string | null = null;
        try {
            stored = localStorage.getItem(THEME_KEY);
        } catch {}
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setThemeState(readThemeChoice(stored));
        setSystemDark(window.matchMedia("(prefers-color-scheme: dark)").matches);
        setSynced(true);
    }, []);

    const resolvedTheme = useMemo(() => resolveTheme(theme, systemDark), [theme, systemDark]);

    // Apply the class (the init script already did on load; this handles later changes). Never writes storage.
    // Skipped until synced so the pre-sync "dark" never overrides the class set by the init script.
    useEffect(() => {
        if (!synced) return;
        const root = document.documentElement;
        root.classList.remove("light", "dark");
        root.classList.add(resolvedTheme);
    }, [resolvedTheme, synced]);

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
        } catch {
            // storage unavailable (private mode etc.): theme still applies for this session
        }
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
