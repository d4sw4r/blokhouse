import { describe, it, expect } from "vitest";
import { auditAction, AUDIT_ACTIONS } from "../../lib/ui/auditActions.ts";
import { relationType, RELATION_TYPES } from "../../lib/ui/relationTypes.ts";
import { priorityTone, PRIORITIES } from "../../lib/ui/priority.ts";
import { toneBgClass, humanize } from "../../lib/ui/tone.ts";

describe("auditAction", () => {
    it("maps the known actions", () => {
        expect(auditAction("CREATE")).toEqual({ tone: "success", label: "Created" });
        expect(auditAction("UPDATE")).toEqual({ tone: "accent", label: "Updated" });
        expect(auditAction("DELETE")).toEqual({ tone: "danger", label: "Deleted" });
        expect(auditAction("LOGIN").tone).toBe("success");
        expect(auditAction("LOGOUT").tone).toBe("neutral");
        expect(auditAction("API_TOKEN_CREATED").tone).toBe("success");
        expect(AUDIT_ACTIONS).toContain("API_TOKEN_DELETED");
        expect(auditAction("API_TOKEN_DELETED").tone).toBe("danger");
    });
    it("falls back to neutral with a readable label", () => {
        expect(auditAction("PASSWORD_RESET")).toEqual({ tone: "neutral", label: "Password reset" });
    });
});

describe("relationType", () => {
    it("maps the known types", () => {
        expect(relationType("DEPENDS_ON")).toEqual({ tone: "danger", label: "Depends on" });
        expect(relationType("CONTAINS").tone).toBe("warning");
        expect(RELATION_TYPES.map((r) => r.value)).toEqual(["DEPENDS_ON", "RUNS_ON", "CONNECTED_TO", "CONTAINS", "PART_OF", "MANAGES"]);
    });
    it("falls back to neutral", () => {
        expect(relationType("BACKS_UP")).toEqual({ tone: "neutral", label: "Backs up" });
    });
});

describe("priorityTone", () => {
    it("maps the known priorities", () => {
        expect(priorityTone("CRITICAL")).toEqual({ tone: "danger", label: "Critical" });
        expect(priorityTone("LOW")).toEqual({ tone: "neutral", label: "Low" });
        expect(PRIORITIES).toHaveLength(4);
    });
    it("falls back to neutral", () => {
        expect(priorityTone("URGENT")).toEqual({ tone: "neutral", label: "Urgent" });
    });
});

describe("tone helpers", () => {
    it("toneBgClass maps tones and falls back to neutral", () => {
        expect(toneBgClass("success")).toBe("bg-success");
        expect(toneBgClass("bogus")).toBe("bg-neutral");
    });
    it("humanize handles empty values", () => {
        expect(humanize("")).toBe("");
        expect(humanize(undefined)).toBe("");
    });
});
