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
    // Lazy-initialize from localStorage to avoid setState inside a mount effect
    const [theme, setTheme] = useState<Theme>(() => {
        if (typeof window === "undefined") return "system";
        return (localStorage.getItem("theme") as Theme) || "system";
    });

    // Lazy-initialize systemDark from matchMedia — only updated via event listener callback
    const [systemDark, setSystemDark] = useState<boolean>(() => {
        if (typeof window === "undefined") return false;
        return window.matchMedia("(prefers-color-scheme: dark)").matches;
    });

    const [mounted, setMounted] = useState(false);

    // Mark as mounted (empty deps → runs once, no cascade risk)
    useEffect(() => {
        setMounted(true);
    }, []);

    // Derive resolved theme — no setState needed
    const resolvedTheme = useMemo((): "light" | "dark" => {
        if (theme !== "system") return theme;
        return systemDark ? "dark" : "light";
    }, [theme, systemDark]);

    // Apply theme classes to <html> and persist preference
    useEffect(() => {
        if (!mounted) return;
        const root = document.documentElement;
        root.classList.remove("light", "dark");
        root.classList.add(resolvedTheme);
        localStorage.setItem("theme", theme);
    }, [resolvedTheme, theme, mounted]);

    // Listen for system preference changes — setState only inside the callback, never synchronously
    useEffect(() => {
        if (theme !== "system") return;
        const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
        const handleChange = (e: MediaQueryListEvent) => setSystemDark(e.matches);
        mediaQuery.addEventListener("change", handleChange);
        return () => mediaQuery.removeEventListener("change", handleChange);
    }, [theme]);

    // Prevent flash of wrong theme
    if (!mounted) {
        return (
            <div style={{ visibility: "hidden" }}>
                {children}
            </div>
        );
    }

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
