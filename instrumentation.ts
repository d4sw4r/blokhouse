// Runs once when the Next.js server starts (not during `next build`).
export async function register() {
    if (process.env.NEXT_RUNTIME !== "nodejs") return;
    // Set WEBHOOK_WORKER=false on replicas that should not send webhooks.
    if (process.env.WEBHOOK_WORKER === "false") return;
    const { startWebhookWorker } = await import("./lib/webhooks");
    startWebhookWorker();
}
