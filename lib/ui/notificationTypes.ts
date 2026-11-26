import {
    Bell,
    FilePlus2,
    FileX2,
    Link2,
    Link2Off,
    PencilLine,
    RefreshCw,
    Settings,
    Wrench,
    type LucideIcon,
} from "lucide-react";
import type { BadgeTone } from "@/components/ui/Badge";

export interface NotificationTypeMeta {
    label: string;
    icon: LucideIcon;
    tone: BadgeTone;
}

// Every type carries an icon and a text label, so colour is never the only cue.
export const notificationTypes: Record<string, NotificationTypeMeta> = {
    ASSET_STATUS_CHANGED: { label: "Status Changed", icon: RefreshCw, tone: "accent" },
    ASSET_CREATED: { label: "Asset Created", icon: FilePlus2, tone: "success" },
    ASSET_DELETED: { label: "Asset Deleted", icon: FileX2, tone: "danger" },
    RELATION_CREATED: { label: "Relation Created", icon: Link2, tone: "accent" },
    RELATION_DELETED: { label: "Relation Deleted", icon: Link2Off, tone: "warning" },
    MAINTENANCE_DUE: { label: "Maintenance Due", icon: Wrench, tone: "warning" },
    CUSTOM_FIELD_CHANGED: { label: "Field Changed", icon: PencilLine, tone: "neutral" },
    SYSTEM: { label: "System", icon: Settings, tone: "neutral" },
};

export function notificationTypeMeta(type: string): NotificationTypeMeta {
    return notificationTypes[type] ?? { label: type, icon: Bell, tone: "neutral" };
}

export const notificationIconColor: Record<BadgeTone, string> = {
    neutral: "text-muted",
    accent: "text-accent",
    success: "text-success",
    warning: "text-warning",
    danger: "text-danger",
};
