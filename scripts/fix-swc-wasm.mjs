#!/usr/bin/env node
/**
 * This machine's Windows Application Control policy blocks Next's native
 * SWC binary (next-swc.win32-x64-msvc.node), and Next's own on-demand
 * wasm download is unreliable here. This postinstall copies the pinned
 * @next/swc-wasm-nodejs devDependency into next/wasm/, where Next's
 * fallback loader finds it. No-op when paths are missing (CI/Linux,
 * where the native binary loads fine).
 */
import { cpSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";

const pnpmDir = join(process.cwd(), "node_modules", ".pnpm");
if (!existsSync(pnpmDir)) process.exit(0);

const entries = readdirSync(pnpmDir);
const wasmPkg = entries.find((e) => e.startsWith("@next+swc-wasm-nodejs@"));
const nextPkg = entries.find((e) => e.startsWith("next@"));
if (!wasmPkg || !nextPkg) process.exit(0);

const src = join(pnpmDir, wasmPkg, "node_modules", "@next", "swc-wasm-nodejs");
const dst = join(pnpmDir, nextPkg, "node_modules", "next", "wasm", "@next", "swc-wasm-nodejs");
if (!existsSync(src)) process.exit(0);

mkdirSync(dst, { recursive: true });
cpSync(src, dst, { recursive: true });
console.log("swc wasm fallback staged into next/wasm (App Control workaround).");
