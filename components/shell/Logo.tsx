import Link from "next/link";

export default function Logo() {
    return (
        <Link
            href="/dashboard"
            data-nav-item
            className="flex shrink-0 items-center gap-2 rounded-md px-1 py-1 outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
            <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true" className="text-accent">
                <rect x="2" y="2" width="8" height="8" rx="1.5" fill="currentColor" />
                <rect x="12" y="2" width="8" height="8" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
                <rect x="2" y="12" width="8" height="8" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
                <rect x="12" y="12" width="8" height="8" rx="1.5" fill="currentColor" opacity="0.5" />
            </svg>
            <span className="hidden font-mono text-sm font-medium text-text min-[420px]:inline">blokhouse</span>
        </Link>
    );
}
