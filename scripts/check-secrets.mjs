#!/usr/bin/env node
/**
 * Greps the built client bundle for server-only secrets. Fails on any hit.
 * Run after `next build`. If .next/static doesn't exist yet, checks source
 * for the NEXT_PUBLIC_ misnaming footgun instead and warns.
 */
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";

const NEEDLES = [
  "SUPABASE_SERVICE_ROLE_KEY",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "ANTHROPIC_API_KEY",
];

const bundleDir = join(process.cwd(), ".next", "static");
const hits = [];

function walk(dir) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.(js|json|txt)$/.test(e)) {
      const body = readFileSync(p, "utf8");
      for (const n of NEEDLES) if (body.includes(n)) hits.push(`${p}: ${n}`);
    }
  }
}

if (!existsSync(bundleDir)) {
  console.log("No .next/static bundle found — run `pnpm build` first for the full check.");
  // Cheap source-level guard meanwhile: these names must never be NEXT_PUBLIC_.
  const bad = [];
  function walkSrc(dir) {
    for (const e of readdirSync(dir)) {
      if (["node_modules", ".next", ".git"].includes(e)) continue;
      const p = join(dir, e);
      if (statSync(p).isDirectory()) walkSrc(p);
      else if (/\.(ts|tsx|js|mjs)$/.test(e)) {
        const body = readFileSync(p, "utf8");
        for (const n of NEEDLES) {
          if (body.includes(`NEXT_PUBLIC_${n}`)) bad.push(`${p}: NEXT_PUBLIC_${n}`);
        }
      }
    }
  }
  walkSrc(process.cwd());
  if (bad.length) {
    console.error("Server-only secret exposed as NEXT_PUBLIC_:\n" + bad.join("\n"));
    process.exit(1);
  }
  console.log("Source check passed: no server-only secret named NEXT_PUBLIC_.");
  process.exit(0);
}

walk(bundleDir);
if (hits.length) {
  console.error("SECRET IN CLIENT BUNDLE:\n" + hits.join("\n"));
  process.exit(1);
}
console.log("Secrets check passed: client bundle is clean.");
