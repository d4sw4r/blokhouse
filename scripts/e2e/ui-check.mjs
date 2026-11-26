// UI check: layout, themes and navigation, against a running Blokhouse instance.
// Plain Node + Playwright, no test runner:
//   npm i --no-save playwright@1.63.0 && npx playwright install chromium
//   BASE_URL=http://localhost:3000 ADMIN_EMAIL=... ADMIN_PASSWORD=... \
//   READONLY_EMAIL=... READONLY_PASSWORD=... node scripts/e2e/ui-check.mjs [--empty]
// For every page in ui-pages.json x theme (dark, light) x width (1280, 390), as ADMIN:
// no console errors / page errors, no horizontal overflow, at 1280 px no overlapping
// top-bar items, and a screenshot in ui-screenshots/. A path may contain ":first", which
// is replaced by the id of the first item from GET /api/configuration-items.
// Extra checks: theme persistence, keyboard navigation, READONLY navigation links.
// --empty runs only the per-page pass (on an install with no items, before ui-seed.mjs).
import { chromium } from "playwright";
import { readFileSync, mkdirSync } from "node:fs";

const BASE = process.env.BASE_URL || "http://localhost:3000";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@example.com";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const READONLY_EMAIL = process.env.READONLY_EMAIL || "readonly@example.com";
const READONLY_PASSWORD = process.env.READONLY_PASSWORD || "ui-readonly-password";
const TIMEOUT = 60_000; // first visit to a page compiles it on the dev server
const EMPTY = process.argv.includes("--empty");
const THEMES = ["dark", "light"];
const WIDTHS = [1280, 390];
const SHOTS = new URL("../../ui-screenshots/", import.meta.url).pathname;

if (!ADMIN_PASSWORD) {
    console.error("ADMIN_PASSWORD required");
    process.exit(1);
}

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

mkdirSync(SHOTS, { recursive: true });
const pages = JSON.parse(readFileSync(new URL("./ui-pages.json", import.meta.url), "utf8"));
const browser = await chromium.launch({ headless: true });

// Sign in through the /signin form; returns the storage state to reuse per role.
async function login(email, password) {
    const context = await browser.newContext({ baseURL: BASE });
    const page = await context.newPage();
    page.setDefaultTimeout(TIMEOUT);
    await page.goto("/signin");
    await page.getByPlaceholder("Email").fill(email);
    await page.getByPlaceholder("Password").fill(password);
    await page.locator('form button[type="submit"]').click();
    await page.waitForURL(/\/dashboard/);
    const state = await context.storageState();
    await context.close();
    return state;
}

async function newPage(state, width, theme) {
    const context = await browser.newContext({
        baseURL: BASE,
        storageState: state,
        viewport: { width, height: width > 600 ? 800 : 844 },
    });
    if (theme) {
        await context.addInitScript((t) => {
            try {
                localStorage.setItem("blokhouse-theme", t);
            } catch {}
        }, theme);
    }
    const page = await context.newPage();
    page.setDefaultTimeout(TIMEOUT);
    return { context, page };
}

const adminState = await login(ADMIN_EMAIL, ADMIN_PASSWORD).catch((e) => {
    console.error(`FAIL admin login\n     ${e?.stack || e}`);
    process.exit(1);
});

// ":first" -> id of the first item the API lists
let firstItemId;
async function resolvePath(path) {
    if (!path.includes(":first")) return path;
    if (firstItemId === undefined) {
        const { context } = await newPage(adminState, 1280);
        const res = await context.request.get("/api/configuration-items?limit=1");
        const body = await res.json();
        firstItemId = body.items?.[0]?.id ?? null;
        await context.close();
    }
    return firstItemId ? path.replaceAll(":first", firstItemId) : null;
}

// The shell renders its links once the session has loaded; the user-menu trigger appears with them.
const shellReady = (page) => page.locator('[aria-label="User menu"]').waitFor({ state: "attached" });

const slug = (p) => p.replace(/^\/+|\/+$/g, "").replace(/[^a-zA-Z0-9]+/g, "-") || "root";

// 1. Per page x theme x width, as admin
for (const entry of pages) {
    const path = await resolvePath(entry.path);
    if (!path) {
        console.log(`skip ${entry.path} (no items on this install)`);
        continue;
    }
    for (const theme of THEMES) {
        for (const width of WIDTHS) {
            await check(`${path} ${theme} ${width}px`, async () => {
                const { context, page } = await newPage(adminState, width, theme);
                try {
                    const problems = [];
                    page.on("console", (m) => m.type() === "error" && problems.push(`console: ${m.text()}`));
                    page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
                    const res = await page.goto(path, { waitUntil: "load" });
                    await page.waitForLoadState("networkidle").catch(() => {});
                    await shellReady(page);
                    assert(res?.status() === 200, `HTTP ${res?.status()}`);
                    assert(new URL(page.url()).pathname === path.split("?")[0], `redirected to ${page.url()}`);
                    assert(
                        await page.evaluate((t) => document.documentElement.classList.contains(t), theme),
                        `<html> lacks class ${theme}`,
                    );
                    await page.screenshot({ path: `${SHOTS}${EMPTY ? "empty-" : ""}${theme}-${width}-${slug(path)}.png`, fullPage: true });
                    const overflow = await page.evaluate(() => ({
                        sw: document.documentElement.scrollWidth,
                        iw: window.innerWidth,
                    }));
                    assert(overflow.sw <= overflow.iw, `horizontal overflow: scrollWidth ${overflow.sw} > innerWidth ${overflow.iw}`);
                    if (width === 1280) {
                        const boxes = await page.$$eval("[data-nav-item]", (els) =>
                            els
                                .map((e) => ({ label: e.getAttribute("aria-label") || e.textContent.trim() || e.tagName, r: e.getBoundingClientRect() }))
                                .filter((b) => b.r.width > 0 && b.r.height > 0)
                                .map((b) => ({ label: b.label, x: b.r.x, y: b.r.y, w: b.r.width, h: b.r.height })),
                        );
                        assert(boxes.length > 0, "no visible [data-nav-item]");
                        for (let i = 0; i < boxes.length; i++) {
                            for (let j = i + 1; j < boxes.length; j++) {
                                const a = boxes[i], b = boxes[j];
                                const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
                                const oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
                                assert(!(ox > 0.5 && oy > 0.5), `nav items overlap: "${a.label}" and "${b.label}"`);
                            }
                        }
                    }
                    assert(problems.length === 0, problems.join("\n     "));
                } finally {
                    await context.close();
                }
            });
        }
    }
}

if (EMPTY) {
    await browser.close();
    if (failures) process.exit(1);
    console.log("UI check (empty install): all checks passed");
    process.exit(0);
}

// 2. Theme persistence: pick Light in the user menu, reload, class is set at DOMContentLoaded
await check("theme: Light picked in the user menu survives a reload without a flash", async () => {
    const { context, page } = await newPage(adminState, 1280);
    try {
        await page.addInitScript(() => {
            document.addEventListener("DOMContentLoaded", () => {
                window.__htmlClassAtDCL = document.documentElement.className;
            });
        });
        await page.goto("/dashboard");
        assert(await page.evaluate(() => document.documentElement.classList.contains("dark")), "default theme is not dark");
        await page.getByRole("button", { name: "User menu" }).click();
        await page.getByRole("menuitemradio", { name: "Light" }).click();
        await page.waitForFunction(() => document.documentElement.classList.contains("light"));
        await page.reload({ waitUntil: "load" });
        const cls = await page.evaluate(() => window.__htmlClassAtDCL);
        assert(/\blight\b/.test(cls) && !/\bdark\b/.test(cls), `<html> class at DOMContentLoaded was "${cls}"`);
        assert((await page.evaluate(() => localStorage.getItem("blokhouse-theme"))) === "light", "blokhouse-theme not 'light'");
    } finally {
        await context.close();
    }
});

// 3. Keyboard: Tab to the first nav group, Enter opens, ArrowDown moves, Escape closes
await check("keyboard: nav group menu opens with Enter, ArrowDown moves, Escape returns focus", async () => {
    const { context, page } = await newPage(adminState, 1280);
    try {
        await page.goto("/dashboard");
        await shellReady(page);
        const onTrigger = () => page.evaluate(() => document.activeElement?.matches("[data-nav-item][aria-haspopup]") ?? false);
        let found = false;
        for (let i = 0; i < 40 && !found; i++) {
            await page.keyboard.press("Tab");
            found = await onTrigger();
        }
        assert(found, "Tab never reached a nav group trigger");
        const label = await page.evaluate(() => document.activeElement.textContent.trim());
        await page.keyboard.press("Enter");
        await page.getByRole("menu").waitFor({ state: "visible" });
        await page.keyboard.press("ArrowDown");
        assert(
            await page.evaluate(() => document.activeElement?.getAttribute("role")?.startsWith("menuitem") ?? false),
            "focus is not on a menu item after ArrowDown",
        );
        await page.keyboard.press("Escape");
        await page.getByRole("menu").waitFor({ state: "hidden" });
        assert(
            await page.evaluate(() => document.activeElement?.matches("[data-nav-item][aria-haspopup]") ?? false),
            `focus did not return to the "${label}" trigger`,
        );
        assert((await page.evaluate(() => document.activeElement.textContent.trim())) === label, "focus returned to a different trigger");
    } finally {
        await context.close();
    }
});

// 4. READONLY: every nav link answers 200 without redirect, none under /admin except /admin/api
await check("READONLY: every nav link answers 200, none under /admin except /admin/api", async () => {
    const state = await login(READONLY_EMAIL, READONLY_PASSWORD);
    const { context, page } = await newPage(state, 1280);
    try {
        await page.goto("/dashboard");
        await shellReady(page);
        const hrefs = new Set();
        const collect = async (sel) =>
            (await page.$$eval(sel, (as) => as.map((a) => a.getAttribute("href")))).forEach((h) => h && hrefs.add(h));
        await collect("a[data-nav-item][href]");
        const triggers = page.locator('[data-nav-item][aria-haspopup="menu"]');
        const n = await triggers.count();
        for (let i = 0; i < n; i++) {
            const t = triggers.nth(i);
            if (!(await t.isVisible())) continue;
            await t.click();
            await page.getByRole("menu").waitFor({ state: "visible" });
            await collect('[role="menu"] a[href]');
            await page.keyboard.press("Escape");
            await page.getByRole("menu").waitFor({ state: "hidden" });
        }
        const local = [...hrefs].filter((h) => h.startsWith("/"));
        assert(local.length > 0, "no navigation links found");
        console.log(`     READONLY links: ${local.join(" ")}`);
        const errors = [];
        for (const h of local) {
            const p = h.split(/[?#]/)[0];
            if (p.startsWith("/admin") && p !== "/admin/api" && !p.startsWith("/admin/api/")) errors.push(`${h}: admin link visible to READONLY`);
            const res = await page.goto(h, { waitUntil: "load" });
            await page.waitForLoadState("networkidle").catch(() => {});
            const final = new URL(page.url()).pathname;
            if (res?.status() !== 200) errors.push(`${h}: HTTP ${res?.status()}`);
            else if (final !== p) errors.push(`${h}: redirected to ${final}`);
        }
        assert(errors.length === 0, errors.join("\n     "));
    } finally {
        await context.close();
    }
});

await browser.close();
if (failures) process.exit(1);
console.log("UI check: all checks passed");
