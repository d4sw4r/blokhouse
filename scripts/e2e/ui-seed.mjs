// Seeds a Blokhouse instance for the UI check (scripts/e2e/ui-check.mjs) through the API:
// a READONLY user, 8 items (one with a 60-character name, one with an IPv6 address and
// ten tags) and 5 relations. Idempotent-ish: existing users, items, tags and relations
// are skipped, so reruns against a local database are safe.
//   BASE_URL=http://localhost:3000 ADMIN_EMAIL=... ADMIN_PASSWORD=... \
//   READONLY_EMAIL=... READONLY_PASSWORD=... node scripts/e2e/ui-seed.mjs
import { request } from "playwright";

const BASE = process.env.BASE_URL || "http://localhost:3000";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@example.com";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const READONLY_EMAIL = process.env.READONLY_EMAIL || "readonly@example.com";
const READONLY_PASSWORD = process.env.READONLY_PASSWORD || "ui-readonly-password";
if (!ADMIN_PASSWORD) {
    console.error("ADMIN_PASSWORD required");
    process.exit(1);
}

const api = await request.newContext({ baseURL: BASE });

// Session cookie via the credentials callback (same flow as scripts/smoke-test.sh).
const { csrfToken } = await (await api.get("/api/auth/csrf")).json();
await api.post("/api/auth/callback/credentials", {
    form: { csrfToken, email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
});
const session = await (await api.get("/api/auth/session")).json();
if (!session?.user) {
    console.error("seed: admin login failed");
    process.exit(1);
}

async function must(res, what) {
    if (!res.ok()) throw new Error(`${what}: ${res.status()} ${await res.text()}`);
    return res.json();
}

// READONLY user
const users = await must(await api.get("/api/users"), "list users");
if (users.some((u) => u.email === READONLY_EMAIL)) {
    console.log(`skip user ${READONLY_EMAIL} (exists)`);
} else {
    await must(
        await api.post("/api/users", {
            data: { name: "UI Readonly", email: READONLY_EMAIL, password: READONLY_PASSWORD, role: "READONLY" },
        }),
        "create user",
    );
    console.log(`created user ${READONLY_EMAIL}`);
}

// Tags
const TAGS = ["production", "staging", "linux", "database", "web", "edge", "backup", "monitoring", "internal", "critical"];
const existingTags = new Map((await must(await api.get("/api/tags"), "list tags")).map((t) => [t.name, t.id]));
for (const name of TAGS) {
    if (existingTags.has(name)) continue;
    const tag = await must(await api.post("/api/tags", { data: { name } }), `create tag ${name}`);
    existingTags.set(name, tag.id);
}

// Items. The last one created is the newest, i.e. the first item the API lists.
const LONG_NAME = "db-replica-eu-central-1-rack-17-slot-04-primary-failover-nod"; // 60 characters
const IPV6 = "2001:db8:85a3::8a2e:370:7334";
const ITEMS = [
    { name: "web-01", ip: "10.20.0.11", tags: ["production", "web"] },
    { name: "web-02", ip: "10.20.0.12", tags: ["production", "web"] },
    { name: "db-01", ip: "10.20.0.21", tags: ["production", "database"] },
    { name: "cache-01", ip: "10.20.0.31", status: "MAINTENANCE" },
    { name: "backup-01", ip: "10.20.0.41", status: "DEPRECATED", tags: ["backup"] },
    { name: "lb-01", ip: "10.20.0.5", mac: "AA:BB:CC:DD:EE:01", tags: ["edge"] },
    { name: "ipv6-node-01", ip: IPV6, tags: TAGS },
    { name: LONG_NAME, ip: "10.20.0.99" },
];
const have = new Map(
    (await must(await api.get("/api/configuration-items?limit=1000"), "list items")).items.map((i) => [i.name, i.id]),
);
for (const it of ITEMS) {
    if (have.has(it.name)) {
        console.log(`skip item ${it.name} (exists)`);
        continue;
    }
    const created = await must(
        await api.post("/api/configuration-items", {
            data: {
                name: it.name,
                ip: it.ip,
                mac: it.mac,
                status: it.status,
                tagIds: (it.tags || []).map((t) => existingTags.get(t)),
            },
        }),
        `create item ${it.name}`,
    );
    have.set(it.name, created.id);
    console.log(`created item ${it.name}`);
}

// Relations: [source, target, type]
const RELATIONS = [
    ["web-01", "db-01", "DEPENDS_ON"],
    ["web-02", "db-01", "DEPENDS_ON"],
    ["lb-01", "web-01", "CONNECTS_TO"],
    ["lb-01", "web-02", "CONNECTS_TO"],
    ["db-01", "backup-01", "BACKED_UP_BY"],
];
for (const [s, t, type] of RELATIONS) {
    const res = await api.post(`/api/configuration-items/${have.get(s)}/relations`, {
        data: { targetId: have.get(t), type },
    });
    if (res.ok()) console.log(`created relation ${s} ${type} ${t}`);
    else if (res.status() === 409) console.log(`skip relation ${s} ${type} ${t} (exists)`);
    else throw new Error(`create relation ${s} ${type} ${t}: ${res.status()} ${await res.text()}`);
}

await api.dispose();
console.log("UI seed done");
