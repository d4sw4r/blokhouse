import { describe, it, expect } from "vitest";
import { formatRelativeTime } from "../../lib/ui/relativeTime.ts";

const now = new Date("2026-11-28T12:00:00Z");
const ago = (ms) => new Date(now.getTime() - ms);
const S = 1000, M = 60 * S, H = 60 * M, D = 24 * H;

describe("formatRelativeTime", () => {
    it("30 seconds -> just now", () => expect(formatRelativeTime(ago(30 * S), now)).toBe("just now"));
    it("5 minutes", () => expect(formatRelativeTime(ago(5 * M), now)).toBe("5 min ago"));
    it("2 hours", () => expect(formatRelativeTime(ago(2 * H), now)).toBe("2 h ago"));
    it("1 day", () => expect(formatRelativeTime(ago(D), now)).toBe("1 day ago"));
    it("3 days", () => expect(formatRelativeTime(ago(3 * D), now)).toBe("3 days ago"));
    it("4 months", () => expect(formatRelativeTime(ago(125 * D), now)).toBe("4 months ago"));
    it("2 years", () => expect(formatRelativeTime(ago(740 * D), now)).toBe("2 years ago"));
    it("accepts ISO strings", () => expect(formatRelativeTime("2026-11-28T09:00:00Z", now)).toBe("3 h ago"));
    it("future date does not throw", () => {
        expect(formatRelativeTime(new Date(now.getTime() + 5 * D), now)).toBe("just now");
    });
    it("invalid date does not throw", () => expect(formatRelativeTime("nope", now)).toBe(""));
});
