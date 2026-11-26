"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { isActiveHref, isItemActive, isMenu, type NavItem } from "@/lib/ui/nav";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/DropdownMenu";

const itemBase =
    "relative inline-flex h-14 items-center gap-1 px-2.5 text-sm font-medium xl:px-3 outline-none transition-colors duration-150 motion-reduce:transition-none hover:text-text focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent";
const activeCls = "text-text shadow-[inset_0_-2px_0_0_var(--accent)]";

export default function NavMenu({ items }: { items: NavItem[] }) {
    const pathname = usePathname();
    return (
        <nav aria-label="Main" className="hidden lg:block">
            <ul className="flex items-center">
                {items.map((item) => {
                    const active = isItemActive(pathname, item);
                    const cls = cn(itemBase, active ? activeCls : "text-muted");
                    return (
                        <li key={item.label}>
                            {isMenu(item) ? (
                                <DropdownMenu>
                                    <DropdownMenuTrigger data-nav-item className={cls}>
                                        {item.label}
                                        <ChevronDown className="size-3.5" aria-hidden="true" />
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="start" sideOffset={0}>
                                        {item.entries.map((e) => (
                                            <DropdownMenuItem key={e.href} asChild>
                                                <Link
                                                    href={e.href}
                                                    aria-current={isActiveHref(pathname, e.href) ? "page" : undefined}
                                                    className={cn(isActiveHref(pathname, e.href) && "text-accent")}
                                                >
                                                    {e.label}
                                                </Link>
                                            </DropdownMenuItem>
                                        ))}
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            ) : (
                                <Link
                                    href={item.href}
                                    data-nav-item
                                    aria-current={active ? "page" : undefined}
                                    className={cls}
                                >
                                    {item.label}
                                </Link>
                            )}
                        </li>
                    );
                })}
            </ul>
        </nav>
    );
}
