import { Badge } from "@/components/ui/Badge";
import type { Tag } from "@/lib/ui/types";

/** Tag name with a swatch of the tag's own colour; the name carries the meaning. */
export function TagBadge({ tag, children }: { tag: Tag; children?: React.ReactNode }) {
    return (
        <Badge className="max-w-full gap-1.5">
            <span
                aria-hidden="true"
                className="size-2 shrink-0 rounded-full bg-neutral"
                style={tag.color ? { backgroundColor: tag.color } : undefined}
            />
            <span className="truncate" title={tag.name}>
                {tag.name}
            </span>
            {children}
        </Badge>
    );
}
