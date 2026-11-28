const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

function plural(n: number, unit: string): string {
    return `${n} ${unit}${n === 1 ? "" : "s"} ago`;
}

/** Short English relative time. Future or invalid dates never throw. */
export function formatRelativeTime(date: Date | string, now: Date = new Date()): string {
    const t = new Date(date).getTime();
    if (Number.isNaN(t)) return "";
    const diff = now.getTime() - t;
    if (diff < MIN) return "just now"; // includes future dates
    if (diff < HOUR) return `${Math.floor(diff / MIN)} min ago`;
    if (diff < DAY) return `${Math.floor(diff / HOUR)} h ago`;
    const days = Math.floor(diff / DAY);
    if (days < 30) return plural(days, "day");
    if (days < 365) return plural(Math.floor(days / 30), "month");
    return plural(Math.floor(days / 365), "year");
}
