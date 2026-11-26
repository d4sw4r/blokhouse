import Link from "next/link";

export function LogoMark({ size = 22, className = "text-accent" }: { size?: number; className?: string }) {
    return (
        <svg width={size} height={size} viewBox="0 0 22 22" aria-hidden="true" className={className}>
            <rect x="2" y="2" width="8" height="8" rx="1.5" fill="currentColor" />
            <rect x="12" y="2" width="8" height="8" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <rect x="2" y="12" width="8" height="8" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <rect x="12" y="12" width="8" height="8" rx="1.5" fill="currentColor" opacity="0.5" />
        </svg>
    );
}

export default function Logo() {
    return (
        <Link
            href="/dashboard"
            data-nav-item
            className="flex shrink-0 items-center gap-2 rounded-md px-1 py-1 outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
            <LogoMark />
            <span className="hidden font-mono text-sm font-medium text-text min-[420px]:inline">blokhouse</span>
        </Link>
    );
}
