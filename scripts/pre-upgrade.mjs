// scripts/pre-upgrade.mjs
// One-off data fix-ups that must run BEFORE `prisma db push` so that the
// schema sync never needs --accept-data-loss.
//
// v0.2: API tokens used to be stored in plain text (column `token`). They are
// now stored as SHA-256 hashes. Plain-text tokens cannot be migrated safely
// (they may have leaked), so they are revoked. Users must create new tokens.
//
// This script is SQLite-specific and will be replaced by Prisma migrations.
import Database from "better-sqlite3";

const url = process.env.DATABASE_URL || "file:./prisma/blokhouse.db";
if (!url.startsWith("file:")) process.exit(0);

const file = url.slice("file:".length);
let db;
try {
    db = new Database(file, { fileMustExist: true });
} catch {
    process.exit(0); // fresh install, nothing to upgrade
}

const cols = db.prepare("PRAGMA table_info('ApiToken')").all().map((c) => c.name);
if (cols.includes("token") && !cols.includes("tokenHash")) {
    const { n } = db.prepare("SELECT COUNT(*) AS n FROM ApiToken").get();
    db.exec("DELETE FROM ApiToken");
    console.warn(
        `[upgrade] Revoked ${n} legacy plain-text API token(s). ` +
            "Create new tokens under Admin → API Tokens and update your integrations."
    );
}
db.close();
