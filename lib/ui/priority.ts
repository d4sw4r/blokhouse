import { humanize, type Tone } from "./tone";

/** Maintenance priority -> badge tone and label. */
export const PRIORITIES: { value: string; label: string; tone: Tone }[] = [
    { value: "LOW", label: "Low", tone: "neutral" },
    { value: "MEDIUM", label: "Medium", tone: "accent" },
    { value: "HIGH", label: "High", tone: "warning" },
    { value: "CRITICAL", label: "Critical", tone: "danger" },
];

export function priorityTone(priority: string): { tone: Tone; label: string } {
    const p = PRIORITIES.find((x) => x.value === priority);
    return p ? { tone: p.tone, label: p.label } : { tone: "neutral", label: humanize(priority) };
}
