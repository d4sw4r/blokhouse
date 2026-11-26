import type { BadgeTone } from "@/components/ui/Badge";

export type Tone = BadgeTone;

/** Title-cases an enum value for display: "API_TOKEN_CREATED" -> "Api token created". */
export function humanize(value: string): string {
    const s = String(value ?? "").replace(/_/g, " ").toLowerCase();
    return s.charAt(0).toUpperCase() + s.slice(1);
}

const bg: Record<Tone, string> = {
    neutral: "bg-neutral",
    accent: "bg-accent",
    success: "bg-success",
    warning: "bg-warning",
    danger: "bg-danger",
};

/** Solid fill for bars, swatches and dots in a tone (always paired with a visible label). */
export function toneBgClass(tone: Tone): string {
    return bg[tone] ?? bg.neutral;
}
