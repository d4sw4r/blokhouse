import { humanize, type Tone } from "./tone";

/** Relation type -> tone and label. Used by the graph (edges + legend), reports and item relations. */
export const RELATION_TYPES: { value: string; label: string; tone: Tone }[] = [
    { value: "DEPENDS_ON", label: "Depends On", tone: "danger" },
    { value: "RUNS_ON", label: "Runs On", tone: "accent" },
    { value: "CONNECTED_TO", label: "Connected To", tone: "success" },
    { value: "CONTAINS", label: "Contains", tone: "warning" },
    { value: "PART_OF", label: "Part Of", tone: "neutral" },
    { value: "MANAGES", label: "Manages", tone: "neutral" },
];

export function relationType(type: string): { tone: Tone; label: string } {
    const t = RELATION_TYPES.find((r) => r.value === type);
    return t ? { tone: t.tone, label: t.label } : { tone: "neutral", label: humanize(type) };
}
