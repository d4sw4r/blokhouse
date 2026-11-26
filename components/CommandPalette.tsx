"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Box, ChevronRight, CornerDownLeft, FileText, Hash, Search, Tag } from "lucide-react";
import { navForRole, isMenu } from "@/lib/ui/nav";
import { Dialog as DialogPrimitive } from "radix-ui";
import { Kbd } from "@/components/ui/Kbd";
import { StatusDot } from "@/components/ui/StatusDot";

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

    const lastFocus = useRef<HTMLElement | null>(null);

    const handleOpenChange = useCallback((open: boolean) => {
        if (open) lastFocus.current = document.activeElement as HTMLElement | null;
        setIsOpen(open);
        if (!open) {
            setQuery("");
            setResults([]);
        }
        setSelectedIndex(0);
    }, []);

    // Keyboard shortcut: Cmd/Ctrl + K to open
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "k") {
                e.preventDefault();
                handleOpenChange(true);
            }
            if (e.key === "/" && !e.metaKey && !e.ctrlKey && !e.altKey) {
                const t = e.target as HTMLElement | null;
                const typing = !!t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable);
                if (!typing) {
                    e.preventDefault();
                    handleOpenChange(true);
                }
            }
        };

        document.addEventListener("keydown", handleKeyDown);
        return () => document.removeEventListener("keydown", handleKeyDown);
    }, [handleOpenChange]);


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
        handleOpenChange(false);
        router.push(result.href);
    }, [router, handleOpenChange]);

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

    // Listen for custom open event from the top bar search trigger
    useEffect(() => {
        const handleOpen = () => handleOpenChange(true);
        document.addEventListener("openCommandPalette", handleOpen);
        return () => document.removeEventListener("openCommandPalette", handleOpen);
    }, [handleOpenChange]);

    const icons = { item: Box, type: Tag, tag: Hash, page: FileText } as const;

    return (
        <DialogPrimitive.Root open={isOpen} onOpenChange={handleOpenChange}>
          <DialogPrimitive.Portal>
            <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-bg/70" />
            <DialogPrimitive.Content
                aria-describedby={undefined}
                onCloseAutoFocus={(e) => {
                    e.preventDefault();
                    lastFocus.current?.focus();
                }}
                className="fixed left-1/2 top-[15vh] z-50 w-[calc(100vw-2rem)] max-w-2xl -translate-x-1/2 overflow-hidden rounded-lg border border-border bg-surface text-text shadow-lg"
            >
                <DialogPrimitive.Title className="sr-only">Command palette</DialogPrimitive.Title>
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
                        role="combobox"
                        aria-expanded="true"
                        aria-controls="palette-listbox"
                        aria-autocomplete="list"
                        aria-activedescendant={all[selectedIndex] ? `palette-opt-${selectedIndex}` : undefined}
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
                        <ul id="palette-listbox" role="listbox" aria-label="Results" className="py-1">
                            {all.map((result, index) => {
                                const Icon = icons[result.type];
                                return (
                                    <li key={`${result.type}-${result.id}`} role="presentation">
                                        <button
                                            type="button"
                                            role="option"
                                            id={`palette-opt-${index}`}
                                            aria-selected={index === selectedIndex}
                                            tabIndex={-1}
                                            onClick={() => handleSelect(result)}
                                            onMouseMove={() => setSelectedIndex(index)}
                                            className={`flex min-h-11 w-full items-center gap-3 px-4 py-2 text-left transition-colors duration-150 motion-reduce:transition-none ${
                                                index === selectedIndex ? "bg-surface-2 outline-2 -outline-offset-2 outline-accent" : ""
                                            }`}
                                        >
                                            <span className="rounded-md bg-surface-2 p-1.5 text-muted">
                                                <Icon className="size-4" aria-hidden="true" />
                                            </span>
                                            <span className="min-w-0 flex-1">
                                                <span className="flex items-center gap-2">
                                                    <span className="truncate text-sm font-medium text-text">{result.title}</span>
                                                    {result.status && <StatusDot status={result.status} size="xs" className="shrink-0" />}
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
            </DialogPrimitive.Content>
          </DialogPrimitive.Portal>
        </DialogPrimitive.Root>
    );
}
