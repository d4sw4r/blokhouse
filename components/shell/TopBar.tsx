"use client";
import { useSession } from "next-auth/react";
import { Search } from "lucide-react";
import { navForRole } from "@/lib/ui/nav";
import { IconButton } from "@/components/ui/IconButton";
import { Kbd } from "@/components/ui/Kbd";
import NotificationBell from "@/components/NotificationBell";
import Logo from "./Logo";
import NavMenu from "./NavMenu";
import MobileNav from "./MobileNav";
import UserMenu from "./UserMenu";

export const OPEN_PALETTE_EVENT = "openCommandPalette";
const openPalette = () => document.dispatchEvent(new CustomEvent(OPEN_PALETTE_EVENT));

export default function TopBar() {
    const { data: session } = useSession();
    const user = session?.user as { name?: string | null; email?: string | null; role?: string } | undefined;
    const role = user?.role ?? "";
    const items = user ? navForRole(role) : [];

    return (
        <header className="sticky top-0 z-40 border-b border-border bg-surface">
            <div className="mx-auto flex h-14 w-full max-w-[1440px] items-center gap-1 px-4 sm:gap-2 sm:px-7">
                {user && items.length > 0 && <MobileNav items={items} />}
                <Logo />
                <div className="ml-2 min-w-0 flex-1">
                    <NavMenu items={items} />
                </div>
                {user && (
                    <>
                        <button
                            type="button"
                            data-nav-item
                            onClick={openPalette}
                            className="hidden h-9 w-32 shrink-0 items-center gap-2 rounded-md border border-border-strong bg-bg px-2.5 text-sm text-muted outline-none transition-colors duration-150 hover:text-text focus-visible:ring-2 focus-visible:ring-accent lg:flex xl:w-56"
                        >
                            <Search className="size-4 shrink-0" aria-hidden="true" />
                            <span className="flex-1 truncate text-left">Search</span>
                            <Kbd className="hidden xl:inline-flex">⌘K</Kbd>
                        </button>
                        <IconButton
                            label="Search"
                            icon={Search}
                            data-nav-item
                            onClick={openPalette}
                            className="lg:hidden"
                        />
                        <NotificationBell navItem />
                        <UserMenu name={user.name || user.email || "User"} role={role} />
                    </>
                )}
            </div>
        </header>
    );
}
