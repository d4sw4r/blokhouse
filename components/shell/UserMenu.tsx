"use client";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { useTheme } from "@/components/ThemeProvider";
import type { ThemeChoice } from "@/lib/ui/theme";
import { Badge } from "@/components/ui/Badge";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/DropdownMenu";

function initials(name: string): string {
    const parts = name.split(/[\s@._-]+/).filter(Boolean);
    const s = parts.length > 1 ? parts[0][0] + parts[1][0] : (parts[0] || "?").slice(0, 2);
    return s.toUpperCase();
}

export default function UserMenu({ name, role }: { name: string; role: string }) {
    const { theme, setTheme } = useTheme();
    return (
        <DropdownMenu>
            <DropdownMenuTrigger
                data-nav-item
                aria-label="User menu"
                className="inline-flex size-9 items-center justify-center rounded-md bg-surface-2 font-mono text-xs font-medium text-text outline-none transition-colors duration-150 hover:bg-border focus-visible:ring-2 focus-visible:ring-accent max-sm:size-11"
            >
                {initials(name)}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60">
                <div className="flex flex-col gap-1.5 px-2 py-2">
                    <span className="truncate text-sm font-medium text-text">{name}</span>
                    <Badge className="self-start">{role}</Badge>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuLabel>Theme</DropdownMenuLabel>
                <DropdownMenuRadioGroup value={theme} onValueChange={(v) => setTheme(v as ThemeChoice)}>
                    <DropdownMenuRadioItem value="dark">Dark</DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="light">Light</DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="system">System</DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                    <Link href="/docs">API docs</Link>
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => signOut()}>Sign out</DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
