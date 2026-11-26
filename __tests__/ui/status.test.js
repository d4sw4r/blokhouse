import { describe, it, expect } from "vitest";
import { statusTone } from "../../lib/ui/status.ts";

describe("statusTone", () => {
    it("maps ACTIVE", () => expect(statusTone("ACTIVE")).toEqual({ tone: "success", label: "Active" }));
    it("maps MAINTENANCE", () => expect(statusTone("MAINTENANCE")).toEqual({ tone: "warning", label: "Maintenance" }));
    it("maps DEPRECATED", () => expect(statusTone("DEPRECATED")).toEqual({ tone: "neutral", label: "Deprecated" }));
    it("title-cases unknown", () => expect(statusTone("RETIRED")).toEqual({ tone: "neutral", label: "Retired" }));
});
