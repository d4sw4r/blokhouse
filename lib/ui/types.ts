/** A tag as the UI receives it from /api/tags (and nested in items). */
export interface Tag {
    id: string;
    name: string;
    color?: string | null;
    description?: string | null;
}
