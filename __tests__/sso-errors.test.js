import { describe, it, expect } from "vitest";
import { SSO_ERROR_MESSAGES, ssoErrorMessage } from "@/lib/sso-errors";

const CODES = [
    "SsoNoEmail", "SsoEmailNotVerified", "SsoLocalAdmin", "SsoNoAccess", "SsoDisabled",
    "SsoServiceAccount", "SsoAlreadyLinked", "SsoError",
    "OAuthSignin", "OAuthCallback", "AccessDenied", "Configuration",
];

describe("sso-errors", () => {
    it.each(CODES)("has a message for %s", (code) => {
        expect(SSO_ERROR_MESSAGES[code]).toBeTruthy();
        expect(ssoErrorMessage(code)).toBe(SSO_ERROR_MESSAGES[code]);
    });
    it("falls back to a generic message for unknown codes", () => {
        expect(ssoErrorMessage("Whatever")).toBeTruthy();
        expect(ssoErrorMessage("Whatever")).toBe(ssoErrorMessage("AlsoUnknown"));
    });
    it("returns empty for no code", () => {
        expect(ssoErrorMessage(null)).toBe("");
    });
});
