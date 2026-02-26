"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";

type Theme = "light" | "dark" | "system";

interface ThemeContextType {
    theme: Theme;
    setTheme: (theme: Theme) => void;
    resolvedTheme: "light" | "dark";
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
    const [theme, setTheme] = useState<Theme>("system");
    const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">("light");
    const [mounted, setMounted] = useState(false);

    // Initialize theme from localStorage or system preference
    useEffect(() => {
        const storedTheme = localStorage.getItem("theme") as Theme | null;
        if (storedTheme) {
            setTheme(storedTheme);
        }
        setMounted(true);
    }, []);

    // Apply theme when it changes
    useEffect(() => {
        if (!mounted) return;

        const root = document.documentElement;
        
        // Remove both classes first
        root.classList.remove("light", "dark");

        let resolved: "light" | "dark";
        
        if (theme === "system") {
            resolved = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
        } else {
            resolved = theme;
        }

        root.classList.add(resolved);
        setResolvedTheme(resolved);
        
        // Store preference
        localStorage.setItem("theme", theme);
    }, [theme, mounted]);

    // Listen for system theme changes
    useEffect(() => {
        if (!mounted || theme !== "system") return;

        const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
        
        const handleChange = (e: MediaQueryListEvent) => {
            const root = document.documentElement;
            root.classList.remove("light", "dark");
            const resolved = e.matches ? "dark" : "light";
            root.classList.add(resolved);
            setResolvedTheme(resolved);
        };

        mediaQuery.addEventListener("change", handleChange);
        return () => mediaQuery.removeEventListener("change", handleChange);
    }, [theme, mounted]);

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
