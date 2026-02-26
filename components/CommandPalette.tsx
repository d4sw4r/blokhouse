"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";

interface SearchResult {
    id: string;
    type: "item" | "type" | "tag";
    title: string;
    subtitle: string;
    status?: string;
    color?: string | null;
    href: string;
}

export default function CommandPalette() {
    const [isOpen, setIsOpen] = useState(false);
    const [query, setQuery] = useState("");
    const [results, setResults] = useState<SearchResult[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);
    const router = useRouter();

    // Keyboard shortcut: Cmd/Ctrl + K to open
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "k") {
                e.preventDefault();
                setIsOpen(true);
            }
            if (e.key === "Escape") {
                setIsOpen(false);
            }
        };

        document.addEventListener("keydown", handleKeyDown);
        return () => document.removeEventListener("keydown", handleKeyDown);
    }, []);

    // Focus input when opened
    useEffect(() => {
        if (isOpen && inputRef.current) {
            setTimeout(() => inputRef.current?.focus(), 50);
        }
    }, [isOpen]);

    // Search API call
    useEffect(() => {
        if (!query.trim() || query.length < 2) {
            setResults([]);
            return;
        }

        const timer = setTimeout(async () => {
            setLoading(true);
            try {
                const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
                if (res.ok) {
                    const data = await res.json();
                    setResults(data.results || []);
                    setSelectedIndex(0);
                }
            } catch (error) {
                console.error("Search failed:", error);
            } finally {
                setLoading(false);
            }
        }, 150);

        return () => clearTimeout(timer);
    }, [query]);

    const handleSelect = useCallback((result: SearchResult) => {
        setIsOpen(false);
        setQuery("");
        router.push(result.href);
    }, [router]);

    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === "ArrowDown") {
            e.preventDefault();
            setSelectedIndex((prev) => (prev + 1) % results.length);
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setSelectedIndex((prev) => (prev - 1 + results.length) % results.length);
        } else if (e.key === "Enter" && results[selectedIndex]) {
            e.preventDefault();
            handleSelect(results[selectedIndex]);
        }
    }, [results, selectedIndex, handleSelect]);

    const getIcon = (type: SearchResult["type"]) => {
        switch (type) {
            case "item":
                return (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                    </svg>
                );
            case "type":
                return (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                    </svg>
                );
            case "tag":
                return (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
                    </svg>
                );
        }
    };

    const getStatusColor = (status?: string) => {
        switch (status) {
            case "ACTIVE":
                return "bg-green-500";
            case "DEPRECATED":
                return "bg-red-500";
            case "MAINTENANCE":
                return "bg-yellow-500";
            default:
                return "bg-gray-400";
        }
    };

    // Listen for custom open event from Navbar
    useEffect(() => {
        const handleOpen = () => setIsOpen(true);
        document.addEventListener("openCommandPalette", handleOpen);
        return () => document.removeEventListener("openCommandPalette", handleOpen);
    }, []);

    if (!isOpen) {
        return null; // Trigger is now in Navbar
    }

    return (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh] px-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                onClick={() => setIsOpen(false)}
            />

            {/* Modal */}
            <div className="relative w-full max-w-2xl bg-white dark:bg-gray-800 rounded-xl shadow-2xl overflow-hidden">
                {/* Search Input */}
                <div className="flex items-center px-4 py-4 border-b border-gray-200 dark:border-gray-700">
                    <svg className="w-6 h-6 text-gray-400 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <input
                        ref={inputRef}
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Search assets, types, tags..."
                        className="flex-1 text-lg bg-transparent border-none outline-none placeholder-gray-400 dark:text-white"
                    />
                    {loading && (
                        <div className="w-5 h-5 border-2 border-gray-300 border-t-brand-primary rounded-full animate-spin" />
                    )}
                    <kbd className="hidden sm:block px-2 py-1 text-xs font-mono bg-gray-100 dark:bg-gray-700 rounded">
                        ESC
                    </kbd>
                </div>

                {/* Results */}
                <div className="max-h-[50vh] overflow-y-auto">
                    {query.length < 2 ? (
                        <div className="p-8 text-center text-gray-500">
                            <p className="text-lg font-medium mb-2">Start typing to search</p>
                            <p className="text-sm">Search for assets, types, or tags</p>
                        </div>
                    ) : results.length === 0 && !loading ? (
                        <div className="p-8 text-center text-gray-500">
                            <p className="text-lg font-medium mb-2">No results found</p>
                            <p className="text-sm">Try a different search term</p>
                        </div>
                    ) : (
                        <div className="py-2">
                            {results.map((result, index) => (
                                <button
                                    key={`${result.type}-${result.id}`}
                                    onClick={() => handleSelect(result)}
                                    className={`w-full px-4 py-3 flex items-center gap-4 text-left transition-colors ${
                                        index === selectedIndex
                                            ? "bg-brand-primary/10 dark:bg-brand-primary/20"
                                            : "hover:bg-gray-50 dark:hover:bg-gray-700/50"
                                    }`}
                                >
                                    <div className={`p-2 rounded-lg ${
                                        result.type === "item" ? "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400" :
                                        result.type === "type" ? "bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400" :
                                        "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400"
                                    }`}>
                                        {getIcon(result.type)}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="font-medium text-gray-900 dark:text-gray-100 truncate">
                                                {result.title}
                                            </span>
                                            {result.status && (
                                                <span className={`w-2 h-2 rounded-full ${getStatusColor(result.status)}`} />
                                            )}
                                            {result.color && (
                                                <span
                                                    className="w-3 h-3 rounded-full border border-gray-300"
                                                    style={{ backgroundColor: result.color }}
                                                />
                                            )}
                                        </div>
                                        <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                                            {result.subtitle}
                                        </p>
                                    </div>
                                    <div className="text-xs text-gray-400 capitalize">
                                        {result.type}
                                    </div>
                                    {index === selectedIndex && (
                                        <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                        </svg>
                                    )}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-4 py-2 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 text-xs text-gray-500 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <span className="flex items-center gap-1">
                            <kbd className="px-1.5 py-0.5 bg-white dark:bg-gray-800 rounded border">↑↓</kbd>
                            to navigate
                        </span>
                        <span className="flex items-center gap-1">
                            <kbd className="px-1.5 py-0.5 bg-white dark:bg-gray-800 rounded border">↵</kbd>
                            to select
                        </span>
                    </div>
                    <span>{results.length} results</span>
                </div>
            </div>
        </div>
    );
}
