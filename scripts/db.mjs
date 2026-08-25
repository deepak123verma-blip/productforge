#!/usr/bin/env node
/**
 * Cross-platform DB runner: node scripts/db.mjs <migrate|test|reset>
 * Uses DATABASE_URL (defaults to the Supabase CLI local Postgres).
 * Migrations are applied with plain psql autocommit — NEVER -1 /
 * --single-transaction (ALTER TYPE ... ADD VALUE forbids it).
 */
import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { join } from "node:path";

const DB_URL =
  process.env.DATABASE_URL ??
  "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

const cmd = process.argv[2];

function psql(args, opts = {}) {
  const r = spawnSync("psql", [DB_URL, "-v", "ON_ERROR_STOP=1", ...args], {
    stdio: "inherit",
    ...opts,
  });
  if (r.error) {
    console.error(`psql not found or failed to start: ${r.error.message}`);
    process.exit(1);
  }
  if (r.status !== 0) process.exit(r.status ?? 1);
}

function migrations() {
  return readdirSync(join("db", "migrations"))
    .filter((f) => f.endsWith(".sql"))
    .sort();
}

switch (cmd) {
  case "migrate":
    for (const f of migrations()) {
      console.log(`applying db/migrations/${f}`);
      psql(["-f", join("db", "migrations", f)]);
    }
    break;
  case "test": {
    // must print PASS per test; any FAIL raises and exits non-zero via ON_ERROR_STOP
    const r = spawnSync("psql", [DB_URL, "-v", "ON_ERROR_STOP=1", "-tA", "-f", join("db", "tests", "smoke_tests.sql")], { encoding: "utf8" });
    if (r.error) {
      console.error(`psql not found: ${r.error.message}`);
      process.exit(1);
    }
    process.stdout.write(r.stdout);
    process.stderr.write(r.stderr);
    const lines = (r.stdout ?? "").split("\n").filter((l) => /^(PASS|FAIL)/.test(l.trim()));
    const fails = lines.filter((l) => !l.trim().startsWith("PASS"));
    if (r.status !== 0 || fails.length) {
      console.error(`\nSmoke tests FAILED (${fails.length} non-PASS of ${lines.length}).`);
      process.exit(1);
    }
    console.log(`\n${lines.length}/${lines.length} PASS`);
    break;
  }
  case "reset":
    psql(["-c", "DROP SCHEMA public CASCADE; CREATE SCHEMA public; GRANT ALL ON SCHEMA public TO public;"]);
    // enums live in public and are dropped with the schema; extensions survive
    break;
  default:
    console.error("usage: node scripts/db.mjs <migrate|test|reset>");
    process.exit(1);
}
