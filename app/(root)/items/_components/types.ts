import type { Tag } from "@/lib/ui/types";
import type { AssetStatus } from "@/lib/ui/itemsQuery";

export type { Tag, AssetStatus };

export interface ConfigItem {
    id: string;
    name: string;
    description?: string;
    ip?: string;
    mac?: string;
    itemTypeId?: string;
    itemType?: { id: string; name: string } | null;
    status: AssetStatus;
    tags: Tag[];
    source?: string | null;
    lastSeenAt?: string | null;
    updatedAt?: string;
}

export interface Type {
    id: string;
    name: string;
}

export interface PaginationData {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}

export interface ItemFormData {
    name: string;
    description: string;
    ip: string;
    mac: string;
    itemTypeId: string;
    status: AssetStatus;
    tagIds: string[];
}

export const statusOptions: { value: AssetStatus; label: string }[] = [
    { value: "ACTIVE", label: "Active" },
    { value: "MAINTENANCE", label: "Maintenance" },
    { value: "DEPRECATED", label: "Deprecated" },
];
