import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
interface Tag {
    id: string;
    name: string;
    color?: string | null;
}

/** Selectable tag chip for forms and bulk operations. */
export function TagToggle({ tag, selected, onToggle }: { tag: Tag; selected: boolean; onToggle: () => void }) {
    return (
        <button
            type="button"
            aria-pressed={selected}
            onClick={onToggle}
            className={cn(
                "inline-flex max-w-full items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium text-text transition-colors duration-150 motion-reduce:transition-none max-sm:min-h-11",
                selected ? "border-accent bg-accent/10" : "border-border-strong bg-surface hover:bg-surface-2",
            )}
        >
            {selected ? (
                <Check className="size-3.5 shrink-0 text-accent" aria-hidden="true" />
            ) : (
                <span
                    aria-hidden="true"
                    className="size-2 shrink-0 rounded-full bg-neutral"
                    style={tag.color ? { backgroundColor: tag.color } : undefined}
                />
            )}
            <span className="truncate">{tag.name}</span>
        </button>
    );
}
