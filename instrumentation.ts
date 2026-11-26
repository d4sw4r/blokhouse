// Runs once when the Next.js server starts (not during `next build`).
export async function register() {
    if (process.env.NEXT_RUNTIME !== "nodejs") return;
    // Fail fast on invalid auth/SSO configuration.
    const { validateAuthConfig } = await import("./lib/oidc");
    validateAuthConfig();
    // Set WEBHOOK_WORKER=false on replicas that should not send webhooks.
    if (process.env.WEBHOOK_WORKER === "false") return;
    const { startWebhookWorker } = await import("./lib/webhooks");
    startWebhookWorker();
}
