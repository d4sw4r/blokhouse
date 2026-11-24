// scripts/import-sqlite.ts
//
// One-time import of a Blokhouse SQLite database (v0.1 / v0.2) into PostgreSQL.
//
//   DATABASE_URL=postgresql://... npx prisma migrate deploy
//   DATABASE_URL=postgresql://... npm run db:import-sqlite -- /path/to/blokhouse.db
//
// Docker:
//   docker compose run --rm -v /path/to/blokhouse.db:/import/blokhouse.db:ro \
//     app npm run db:import-sqlite -- /import/blokhouse.db
//
// - The target database must be migrated and empty (no users), unless --force.
// - Everything runs in one transaction: either all rows are imported or none.
// - Legacy plain-text API tokens (v0.1) are not imported; create new tokens.
// - Columns that exist in only one of the two schemas are skipped.
import Database from "better-sqlite3";
import pg from "pg";

// Parents before children, so foreign keys are satisfied.
const TABLES = [
    "User",
    "Account",
    "Session",
    "VerificationToken",
    "ItemType",
    "Tag",
    "ConfigurationItem",
    "_ConfigurationItemToTag",
    "AssetRelation",
    "ApiToken",
    "AuditLog",
    "CustomField",
    "CustomFieldValue",
    "Notification",
    "MaintenanceSchedule",
    "FavoriteItem",
];

type Row = Record<string, unknown>;

function usage(msg?: string): never {
    if (msg) console.error(`Error: ${msg}\n`);
    console.error("Usage: DATABASE_URL=postgresql://... npm run db:import-sqlite -- <sqlite-file> [--force]");
    process.exit(1);
}

function convert(value: unknown, pgType: string): unknown {
    if (value === null || value === undefined) return null;
    if (pgType.startsWith("timestamp")) {
        // Prisma's SQLite adapters store DateTime as ISO-8601 text or epoch milliseconds.
        if (typeof value === "number" || typeof value === "bigint") return new Date(Number(value));
        if (typeof value === "string" && /^\d+$/.test(value)) return new Date(Number(value));
        return new Date(String(value));
    }
    if (pgType === "boolean") return value === true || value === 1 || value === "1" || value === "true";
    if (pgType === "integer" || pgType === "bigint") return Number(value);
    return value;
}

async function main() {
    const args = process.argv.slice(2);
    const force = args.includes("--force");
    const file = args.find((a) => !a.startsWith("--"));
    if (!file) usage("missing SQLite file");
    if (!process.env.DATABASE_URL?.startsWith("postgres")) usage("DATABASE_URL must be a postgresql:// URL");

    const sqlite = new Database(file, { readonly: true, fileMustExist: true });
    const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
    await client.connect();

    try {
        const migrated = await client.query(`SELECT to_regclass('public."User"') AS t`);
        if (!migrated.rows[0].t) usage("target database is not migrated — run `npx prisma migrate deploy` first");

        const { rows: [{ n: existingUsers }] } = await client.query(`SELECT COUNT(*)::int AS n FROM "User"`);
        if (existingUsers > 0 && !force) {
            usage(`target database already contains ${existingUsers} user(s). Use an empty database or pass --force`);
        }

        const sqliteTables = new Set(
            sqlite.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all().map((r) => (r as Row).name as string)
        );

        await client.query("BEGIN");
        const summary: Record<string, number | string> = {};

        for (const table of TABLES) {
            if (!sqliteTables.has(table)) {
                summary[table] = "not in source";
                continue;
            }

            const pgCols = await client.query(
                `SELECT column_name, data_type FROM information_schema.columns
                 WHERE table_schema = 'public' AND table_name = $1`,
                [table]
            );
            if (pgCols.rowCount === 0) {
                summary[table] = "not in target";
                continue;
            }
            const pgTypes = new Map(pgCols.rows.map((r) => [r.column_name as string, r.data_type as string]));
            const srcCols = (sqlite.prepare(`PRAGMA table_info("${table}")`).all() as Row[]).map((c) => c.name as string);

            if (table === "ApiToken" && !srcCols.includes("tokenHash")) {
                const { n } = sqlite.prepare(`SELECT COUNT(*) AS n FROM "ApiToken"`).get() as { n: number };
                summary[table] = `skipped ${n} legacy plain-text token(s) — create new tokens`;
                continue;
            }

            const cols = srcCols.filter((c) => pgTypes.has(c));
            const rows = sqlite.prepare(`SELECT ${cols.map((c) => `"${c}"`).join(", ")} FROM "${table}"`).all() as Row[];

            const colList = cols.map((c) => `"${c}"`).join(", ");
            const placeholders = cols.map((_, i) => `$${i + 1}`).join(", ");
            const sql = `INSERT INTO "${table}" (${colList}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`;

            let inserted = 0;
            for (const row of rows) {
                const values = cols.map((c) => convert(row[c], pgTypes.get(c)!));
                const res = await client.query(sql, values);
                inserted += res.rowCount ?? 0;
            }
            summary[table] = inserted;
        }

        await client.query("COMMIT");
        console.log("Import finished:");
        for (const [table, result] of Object.entries(summary)) {
            console.log(`  ${table.padEnd(24)} ${result}`);
        }
    } catch (error) {
        await client.query("ROLLBACK").catch(() => {});
        console.error("Import failed, nothing was written:", error instanceof Error ? error.message : error);
        process.exitCode = 1;
    } finally {
        await client.end();
        sqlite.close();
    }
}

main();
