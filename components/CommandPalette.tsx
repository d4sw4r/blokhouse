"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Box, ChevronRight, CornerDownLeft, FileText, Hash, Search, Tag } from "lucide-react";
import { navForRole, isMenu } from "@/lib/ui/nav";
import { Kbd } from "@/components/ui/Kbd";

interface SearchResult {
    id: string;
    type: "item" | "type" | "tag" | "page";
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
    const { data: session } = useSession();
    const role = (session?.user as { role?: string } | undefined)?.role ?? "";

    const pages = useMemo<SearchResult[]>(
        () =>
            navForRole(role).flatMap((item) =>
                isMenu(item)
                    ? item.entries.map((e) => ({ id: e.href, type: "page" as const, title: e.label, subtitle: item.label, href: e.href }))
                    : [{ id: item.href, type: "page" as const, title: item.label, subtitle: "Page", href: item.href }],
            ),
        [role],
    );
    const matchedPages = useMemo(() => {
        const q = query.trim().toLowerCase();
        return q ? pages.filter((p) => p.title.toLowerCase().includes(q) || p.subtitle.toLowerCase().includes(q)) : pages;
    }, [pages, query]);
    const all = useMemo(() => [...matchedPages, ...results], [matchedPages, results]);

    // Keyboard shortcut: Cmd/Ctrl + K to open
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "k") {
                e.preventDefault();
                setIsOpen(true);
            }
            if (e.key === "/" && !e.metaKey && !e.ctrlKey && !e.altKey) {
                const t = e.target as HTMLElement | null;
                const typing = !!t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable);
                if (!typing) {
                    e.preventDefault();
                    setIsOpen(true);
                }
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
        if (all.length === 0) return;
        if (e.key === "ArrowDown") {
            e.preventDefault();
            setSelectedIndex((prev) => (prev + 1) % all.length);
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setSelectedIndex((prev) => (prev - 1 + all.length) % all.length);
        } else if (e.key === "Enter" && all[selectedIndex]) {
            e.preventDefault();
            handleSelect(all[selectedIndex]);
        }
    }, [all, selectedIndex, handleSelect]);

    // Listen for custom open event from Navbar
    useEffect(() => {
        const handleOpen = () => setIsOpen(true);
        document.addEventListener("openCommandPalette", handleOpen);
        return () => document.removeEventListener("openCommandPalette", handleOpen);
    }, []);

    const icons = { item: Box, type: Tag, tag: Hash, page: FileText } as const;
    const statusDot = (status?: string) =>
        status === "ACTIVE" ? "bg-success" : status === "DEPRECATED" ? "bg-danger" : status === "MAINTENANCE" ? "bg-warning" : "bg-neutral";

    if (!isOpen) {
        return null; // Trigger is in the top bar
    }

    return (
        <div className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-[15vh]">
            <div className="absolute inset-0 bg-bg/70" onClick={() => setIsOpen(false)} />

            <div
                role="dialog"
                aria-modal="true"
                aria-label="Command palette"
                className="relative w-full max-w-2xl overflow-hidden rounded-lg border border-border bg-surface text-text shadow-lg"
            >
                <div className="flex items-center gap-3 border-b border-border px-4 py-3">
                    <Search className="size-5 shrink-0 text-muted" aria-hidden="true" />
                    <input
                        ref={inputRef}
                        type="text"
                        value={query}
                        onChange={(e) => { setQuery(e.target.value); setSelectedIndex(0); }}
                        onKeyDown={handleKeyDown}
                        placeholder="Search pages, assets, types, tags..."
                        aria-label="Search"
                        className="min-w-0 flex-1 bg-transparent text-base text-text outline-none placeholder:text-muted"
                    />
                    {loading && <div className="size-4 animate-spin rounded-full border-2 border-border-strong border-t-accent motion-reduce:animate-none" />}
                    <Kbd className="hidden sm:inline-flex">ESC</Kbd>
                </div>

                <div className="max-h-[50vh] overflow-y-auto">
                    {all.length === 0 && !loading ? (
                        <div className="p-8 text-center text-muted">
                            <p className="mb-1 text-base font-medium text-text">No results found</p>
                            <p className="text-sm">Try a different search term</p>
                        </div>
                    ) : (
                        <ul className="py-1">
                            {all.map((result, index) => {
                                const Icon = icons[result.type];
                                return (
                                    <li key={`${result.type}-${result.id}`}>
                                        <button
                                            type="button"
                                            onClick={() => handleSelect(result)}
                                            onMouseMove={() => setSelectedIndex(index)}
                                            className={`flex min-h-11 w-full items-center gap-3 px-4 py-2 text-left transition-colors duration-150 motion-reduce:transition-none ${
                                                index === selectedIndex ? "bg-surface-2" : ""
                                            }`}
                                        >
                                            <span className="rounded-md bg-surface-2 p-1.5 text-muted">
                                                <Icon className="size-4" aria-hidden="true" />
                                            </span>
                                            <span className="min-w-0 flex-1">
                                                <span className="flex items-center gap-2">
                                                    <span className="truncate text-sm font-medium text-text">{result.title}</span>
                                                    {result.status && (
                                                        <span className="flex items-center gap-1 text-xs text-muted">
                                                            <span className={`size-2 rounded-full ${statusDot(result.status)}`} aria-hidden="true" />
                                                            {result.status.toLowerCase()}
                                                        </span>
                                                    )}
                                                    {result.color && (
                                                        <span
                                                            className="size-3 rounded-full border border-border-strong"
                                                            style={{ backgroundColor: result.color }}
                                                            aria-hidden="true"
                                                        />
                                                    )}
                                                </span>
                                                <span className="block truncate text-xs text-muted">{result.subtitle}</span>
                                            </span>
                                            <span className="text-xs capitalize text-muted">{result.type}</span>
                                            {index === selectedIndex && <ChevronRight className="size-4 text-muted" aria-hidden="true" />}
                                        </button>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </div>

                <div className="flex items-center justify-between border-t border-border bg-bg px-4 py-2 text-xs text-muted">
                    <div className="flex items-center gap-4">
                        <span className="flex items-center gap-1"><Kbd>↑↓</Kbd> to navigate</span>
                        <span className="flex items-center gap-1"><Kbd><CornerDownLeft className="size-3" aria-hidden="true" /></Kbd> to select</span>
                    </div>
                    <span>{all.length} results</span>
                </div>
            </div>
        </div>
    );
}
