"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { cn } from "@/lib/utils";
import { isActiveHref, isMenu, type NavItem } from "@/lib/ui/nav";
import { IconButton } from "@/components/ui/IconButton";
import { Sheet } from "@/components/ui/Sheet";

export default function MobileNav({ items }: { items: NavItem[] }) {
    const [open, setOpen] = useState(false);
    const pathname = usePathname();

    const link = (label: string, href: string) => {
        const active = isActiveHref(pathname, href);
        return (
            <Link
                href={href}
                onClick={() => setOpen(false)}
                aria-current={active ? "page" : undefined}
                className={cn(
                    "flex min-h-11 items-center rounded-md px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent hover:bg-surface-2",
                    active ? "text-accent" : "text-text",
                )}
            >
                {label}
            </Link>
        );
    };

    return (
        <div className="lg:hidden">
            <IconButton
                label="Open navigation"
                icon={Menu}
                data-nav-item
                onClick={() => setOpen(true)}
                className="max-sm:size-11"
            />
            <Sheet open={open} onOpenChange={setOpen} side="left" title="Navigation">
                <nav aria-label="Mobile" className="flex flex-col gap-4 p-3">
                    {items.map((item) =>
                        isMenu(item) ? (
                            <div key={item.label}>
                                <h2 className="px-3 pb-1 text-xs font-medium uppercase tracking-wide text-muted">{item.label}</h2>
                                <ul>
                                    {item.entries.map((e) => (
                                        <li key={e.href}>{link(e.label, e.href)}</li>
                                    ))}
                                </ul>
                            </div>
                        ) : (
                            <div key={item.label}>{link(item.label, item.href)}</div>
                        ),
                    )}
                </nav>
            </Sheet>
        </div>
    );
}
