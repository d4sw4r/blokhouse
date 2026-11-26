export type StatusTone = "success" | "warning" | "neutral";

export function statusTone(status: string): { tone: StatusTone; label: string } {
    switch (status) {
        case "ACTIVE":
            return { tone: "success", label: "Active" };
        case "MAINTENANCE":
            return { tone: "warning", label: "Maintenance" };
        case "DEPRECATED":
            return { tone: "neutral", label: "Deprecated" };
        default: {
            const s = String(status ?? "");
            return { tone: "neutral", label: s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() };
        }
    }
}
