// End-to-end test of OIDC single sign-on against a real Keycloak
// (scripts/e2e/docker-compose.sso.yml + scripts/e2e/keycloak/realm-blokhouse.json).
// Plain Node + Playwright, no test runner:
//   npm i --no-save playwright@1.63.0 && npx playwright install chromium
//   BASE_URL=http://localhost:3000 node scripts/e2e/sso.spec.mjs
// With --password-login-disabled (app running with PASSWORD_LOGIN=false) it only
// checks that the sign-in page offers SSO and no password form.
import { chromium } from "playwright";
import { SSO_ERROR_MESSAGES } from "../../lib/sso-errors.js";

const BASE = process.env.BASE_URL || "http://localhost:3000";
const SSO_NAME = process.env.OIDC_NAME || "Keycloak";
const TIMEOUT = 30_000;

let failures = 0;
async function check(name, fn) {
    try {
        await fn();
        console.log(`ok   ${name}`);
    } catch (err) {
        failures++;
        console.error(`FAIL ${name}\n     ${err?.stack || err}`);
    }
}
function assert(cond, msg) {
    if (!cond) throw new Error(msg);
}

const browser = await chromium.launch({ headless: true });

if (process.argv.includes("--password-login-disabled")) {
    await check("PASSWORD_LOGIN=false: sign-in page has SSO and no password field", async () => {
        const page = await browser.newPage({ baseURL: BASE });
        page.setDefaultTimeout(TIMEOUT);
        await page.goto("/signin");
        // The form is hidden once /api/auth/options has loaded; wait for that response.
        const options = await page.request.get("/api/auth/options").then((r) => r.json());
        assert(options.passwordLogin === false, `/api/auth/options: ${JSON.stringify(options)}`);
        await page.getByRole("button", { name: `Sign in with ${SSO_NAME}` }).waitFor();
        await page.waitForFunction(() => !document.querySelector('input[type="password"]'));
        assert((await page.locator('input[type="password"]').count()) === 0, "password field is shown");
        assert((await page.getByPlaceholder("Email").count()) === 0, "email field is shown");
        await page.close();
    });
    await browser.close();
    if (failures) process.exit(1);
    console.log("SSO end-to-end (password login disabled): all checks passed");
    process.exit(0);
}

// Fresh browser context (no cookies) per user; signs in through Keycloak.
async function ssoLogin(username, password) {
    const context = await browser.newContext({ baseURL: BASE });
    const page = await context.newPage();
    page.setDefaultTimeout(TIMEOUT);
    await page.goto("/signin");
    await page.getByRole("button", { name: `Sign in with ${SSO_NAME}` }).click();
    await page.waitForURL(/\/realms\/blokhouse\/protocol\/openid-connect\/auth/);
    await page.fill("#username", username);
    await page.fill("#password", password);
    await page.click("#kc-login");
    await page.waitForURL((url) => url.origin === new URL(BASE).origin && !url.pathname.startsWith("/api/auth/"));
    return { context, page };
}

async function session(page) {
    const res = await page.request.get("/api/auth/session");
    assert(res.ok(), `GET /api/auth/session: HTTP ${res.status()}`);
    return res.json();
}

await check("anna (cmdb-admins) signs in via SSO as ADMIN", async () => {
    const { context, page } = await ssoLogin("anna", "anna-pass");
    try {
        assert(new URL(page.url()).pathname === "/dashboard", `landed on ${page.url()}, expected /dashboard`);
        const s = await session(page);
        assert(s?.user?.email === "anna@example.com", `session email: ${JSON.stringify(s)}`);
        assert(s.user.role === "ADMIN", `session role: ${JSON.stringify(s)}`);
        assert(s.user.sso === true, `session sso flag: ${JSON.stringify(s)}`);
    } finally {
        await context.close();
    }
});

await check("rolf (cmdb-read) signs in as READONLY and cannot open /admin/users", async () => {
    const { context, page } = await ssoLogin("rolf", "rolf-pass");
    try {
        assert(new URL(page.url()).pathname === "/dashboard", `landed on ${page.url()}, expected /dashboard`);
        const s = await session(page);
        assert(s?.user?.email === "rolf@example.com", `session email: ${JSON.stringify(s)}`);
        assert(s.user.role === "READONLY", `session role: ${JSON.stringify(s)}`);
        await page.goto("/admin/users");
        const path = new URL(page.url()).pathname;
        assert(path !== "/admin/users", `READONLY user reached /admin/users`);
        assert(path === "/dashboard", `expected redirect to /dashboard, got ${page.url()}`);
        const api = await page.request.get("/api/users");
        assert(api.status() === 401 || api.status() === 403, `GET /api/users as READONLY: HTTP ${api.status()}`);
    } finally {
        await context.close();
    }
});

await check("nora (no mapped group) is sent back to /signin with SsoNoAccess", async () => {
    const { context, page } = await ssoLogin("nora", "nora-pass");
    try {
        const url = new URL(page.url());
        assert(url.pathname === "/signin", `landed on ${page.url()}, expected /signin`);
        assert(url.searchParams.get("error") === "SsoNoAccess", `error param: ${url.search}`);
        await page.getByText(SSO_ERROR_MESSAGES.SsoNoAccess).waitFor();
        const s = await session(page);
        assert(!s?.user, `nora must not have a session: ${JSON.stringify(s)}`);
    } finally {
        await context.close();
    }
});

await check("anna sees rolf on the users page with SSO badge and locked role", async () => {
    const { context, page } = await ssoLogin("anna", "anna-pass");
    try {
        await page.goto("/admin/users");
        const row = page.locator("tr", { hasText: "rolf@example.com" });
        await row.waitFor();
        await row.getByText("SSO", { exact: true }).waitFor();
        await row.getByText("Managed by SSO").waitFor();
        await row.getByRole("button", { name: "Edit" }).click();
        // In edit mode the email is an input, so find the row by its value.
        const editRow = page.locator("tr", { has: page.locator('input[value="rolf@example.com"]') });
        const select = editRow.locator("select");
        await select.waitFor();
        assert(await select.isDisabled(), "role select for rolf must be disabled");
        assert((await select.inputValue()) === "READONLY", `rolf role select: ${await select.inputValue()}`);
        await editRow.getByText("Role is managed by SSO.").waitFor();
    } finally {
        await context.close();
    }
});

await browser.close();
if (failures) {
    console.error(`${failures} SSO check(s) failed`);
    process.exit(1);
}
console.log("SSO end-to-end: all checks passed");
