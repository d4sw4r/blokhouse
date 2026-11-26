// Readable messages for the ?error= codes on the sign-in page. Client-safe: no server imports.
export const SSO_ERROR_MESSAGES = {
    SsoNoEmail: "Your identity provider did not return an email address, so you cannot be signed in.",
    SsoEmailNotVerified: "Your email address is not verified at the identity provider.",
    SsoLocalAdmin: "This email belongs to a local administrator account. Sign in with a password instead.",
    SsoNoAccess: "Your account has no access to this application. Ask an administrator to grant you a role.",
    SsoDisabled: "Your account has been deactivated. Contact an administrator.",
    SsoServiceAccount: "This email belongs to a service account that cannot sign in via SSO.",
    SsoAlreadyLinked: "This account is already linked to a different identity.",
    SsoError: "Single sign-on failed. Please try again or contact an administrator.",
    OAuthSignin: "Could not start single sign-on. The identity provider may be unreachable.",
    OAuthCallback: "Single sign-on failed while processing the identity provider's response.",
    AccessDenied: "Access denied.",
    Configuration: "Single sign-on is not configured correctly. Contact an administrator.",
};

export const GENERIC_SIGNIN_ERROR = "Sign-in failed. Please try again.";

export function ssoErrorMessage(code) {
    if (!code) return "";
    return Object.prototype.hasOwnProperty.call(SSO_ERROR_MESSAGES, code)
        ? SSO_ERROR_MESSAGES[code]
        : GENERIC_SIGNIN_ERROR;
}
