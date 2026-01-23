// The Forge/forge/ops/scripts/refresh-share-pack.mjs
// Purpose: Build a minimal "Share Pack" snapshot for non-repo-aware agents.
// Notes: Keep deterministic; no network; no heavy deps.

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const REPO_ROOT = process.cwd();
const OUT_DIR = path.join(REPO_ROOT, "The Forge/forge/exports/share-pack");
const OUT_MD = path.join(OUT_DIR, "SHARE_PACK.md");

// Keep this list tight and curated.
// Repo-aware agents may expand it later by WO, but don't explode it.
const INCLUDE = [
  // Forge core
  "The Forge/forge/FORGE_KERNEL.md",
  "The Forge/forge/FORGE_CAPSULE.md",

  // Claude onboarding
  "The Forge/forge/onboarding/claude/CLAUDE_SYSTEM_PROMPT.md",

  // MyFi canonical truth
  "The Forge/myfi/PRODUCT_STATE.md",
  "The Forge/myfi/MIGRATION_PARITY_MATRIX.md",
  "The Forge/myfi/MYFI_ARCHITECTURE_MAP.md",
  "The Forge/myfi/MYFI_GLOSSARY.md",

  // MyFi specs/contracts (folder copy)
  "The Forge/myfi/specs",

  // Work orders (folder copy)
  "The Forge/forge/Work Orders",
  "The Forge/forge/ops", // includes executed WO writeups from Claude if you keep them here
];

// --- helpers
function exists(p) {
  try { fs.accessSync(p); return true; } catch { return false; }
}
function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}
function sha256(buf) {
  return crypto.createHash("sha256").update(buf).digest("hex").slice(0, 12);
}
function copyFile(src, dst) {
  ensureDir(path.dirname(dst));
  fs.copyFileSync(src, dst);
}
function copyDir(srcDir, dstDir) {
  ensureDir(dstDir);
  for (const ent of fs.readdirSync(srcDir, { withFileTypes: true })) {
    const src = path.join(srcDir, ent.name);
    const dst = path.join(dstDir, ent.name);
    if (ent.isDirectory()) copyDir(src, dst);
    else if (ent.isFile()) copyFile(src, dst);
  }
}

function rel(p) {
  return p.replaceAll("\\", "/");
}

function main() {
  ensureDir(OUT_DIR);

  const copied = [];
  const missing = [];

  for (const item of INCLUDE) {
    const abs = path.join(REPO_ROOT, item);
    const out = path.join(OUT_DIR, item);

    if (!exists(abs)) {
      missing.push(item);
      continue;
    }

    const stat = fs.statSync(abs);
    if (stat.isDirectory()) copyDir(abs, out);
    else copyFile(abs, out);

    copied.push(item);
  }

  // Build a small index for humans + machines.
  const now = new Date().toISOString();
  const lines = [];
  lines.push(`# SHARE PACK`);
  lines.push(``);
  lines.push(`Generated: ${now}`);
  lines.push(``);
  lines.push(`## Contents (curated)`);
  lines.push(...copied.map(p => `- ${rel(p)}`));
  lines.push(``);
  if (missing.length) {
    lines.push(`## Missing during generation (non-fatal)`);
    lines.push(...missing.map(p => `- ${rel(p)}`));
    lines.push(``);
  }

  // Hash the manifest so agents can sanity check "same pack".
  const manifestBlob = Buffer.from(lines.join("\n"), "utf8");
  lines.push(`Pack signature: \`${sha256(manifestBlob)}\``);
  lines.push(``);

  fs.writeFileSync(OUT_MD, lines.join("\n"), "utf8");

  console.log(`[share-pack] done. copied=${copied.length} missing=${missing.length}`);
}

main();
