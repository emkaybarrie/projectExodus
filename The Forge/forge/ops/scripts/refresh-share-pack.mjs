// The Forge/forge/ops/scripts/refresh-share-pack.mjs
// Purpose: Build a minimal "Share Pack" snapshot for non-repo-aware agents.
// Notes: Keep deterministic; no network; no heavy deps.
// M2c: Extended to emit JSON indices for Portal consumption.

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execSync } from "node:child_process";

const REPO_ROOT = process.cwd();
const OUT_DIR = path.join(REPO_ROOT, "The Forge/forge/exports/share-pack");
const OUT_MD = path.join(OUT_DIR, "SHARE_PACK.md");
const OUT_INDEX_JSON = path.join(OUT_DIR, "share-pack.index.json");
const OUT_WO_JSON = path.join(OUT_DIR, "work-orders.index.json");

// Work Orders source directories (ops is canonical, others are legacy per session closeout)
const WO_DIRS = [
  path.join(REPO_ROOT, "The Forge/forge/ops"),          // Canonical
  path.join(REPO_ROOT, "The Forge/forge/Work Orders"),  // Legacy
  path.join(REPO_ROOT, "The Forge/forge/work-orders"),  // Orphan
];

// Keep this list tight and curated.
// Repo-aware agents may expand it later by WO, but don't explode it.
// Per SHARE_PACK.md directive: ensure CAPSULE, STATUS_MATRIX, REFERENCE_INDEX are included.
const INCLUDE = [
  // Forge core
  "The Forge/forge/FORGE_KERNEL.md",
  "The Forge/forge/FORGE_CAPSULE.md",

  // Claude onboarding
  "The Forge/forge/onboarding/claude/CLAUDE_SYSTEM_PROMPT.md",

  // MyFi canonical truth (per SHARE_PACK.md directive)
  "The Forge/myfi/PRODUCT_STATE.md",
  "The Forge/myfi/MYFI_CAPSULE.md",           // Required by directive
  "The Forge/myfi/MYFI_STATUS_MATRIX.md",     // Required by directive
  "The Forge/myfi/MIGRATION_PARITY_MATRIX.md",
  "The Forge/myfi/MYFI_ARCHITECTURE_MAP.md",
  "The Forge/myfi/MYFI_GLOSSARY.md",
  "The Forge/myfi/MYFI_MANIFEST.json",
  "The Forge/myfi/MYFI_CHANGELOG.md",
  "The Forge/myfi/MYFI_MASTER_REFERENCE.md",

  // MyFi reference index (per directive: MYFI_REFERENCE_INDEX.json)
  "The Forge/myfi/reference",

  // MyFi specs/contracts (folder copy)
  "The Forge/myfi/specs",

  // Work orders (canonical location per ops consolidation)
  "The Forge/forge/ops",
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
function sha256Full(buf) {
  return crypto.createHash("sha256").update(buf).digest("hex");
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

function getGitCommitSha() {
  try {
    return execSync("git rev-parse HEAD", { encoding: "utf8", cwd: REPO_ROOT }).trim();
  } catch {
    return "unknown";
  }
}

function getGitCommitShort() {
  try {
    return execSync("git rev-parse --short HEAD", { encoding: "utf8", cwd: REPO_ROOT }).trim();
  } catch {
    return "unknown";
  }
}

function extractHeadlines() {
  // Extract key info from files for "headlines" in JSON
  const headlines = {};

  // Kernel version (look for version in FORGE_KERNEL.md)
  const kernelPath = path.join(REPO_ROOT, "The Forge/forge/FORGE_KERNEL.md");
  if (exists(kernelPath)) {
    const content = fs.readFileSync(kernelPath, "utf8");
    const versionMatch = content.match(/Version[:\s]+([^\n]+)/i);
    headlines.kernelVersion = versionMatch ? versionMatch[1].trim() : "unknown";
  }

  // MyFi product state summary (extract last updated and WOs applied)
  const productStatePath = path.join(REPO_ROOT, "The Forge/myfi/PRODUCT_STATE.md");
  if (exists(productStatePath)) {
    const content = fs.readFileSync(productStatePath, "utf8");
    const lastUpdatedMatch = content.match(/\*\*Last Updated:\*\*\s*([^\n]+)/);
    const wosAppliedMatch = content.match(/\*\*Work Orders Applied:\*\*\s*([^\n]+)/);
    headlines.myfiLastUpdated = lastUpdatedMatch ? lastUpdatedMatch[1].trim() : "unknown";
    headlines.myfiWorkOrders = wosAppliedMatch ? wosAppliedMatch[1].trim() : "unknown";
  }

  return headlines;
}

function collectFileHashes(items) {
  const files = [];

  for (const item of items) {
    const abs = path.join(REPO_ROOT, item);
    if (!exists(abs)) continue;

    const stat = fs.statSync(abs);
    if (stat.isFile()) {
      const content = fs.readFileSync(abs);
      files.push({
        path: rel(item),
        hash: sha256Full(content),
        size: stat.size,
        modified: stat.mtime.toISOString()
      });
    } else if (stat.isDirectory()) {
      // Recursively collect files from directory
      collectDirFiles(abs, item, files);
    }
  }

  return files;
}

function collectDirFiles(dirPath, relBase, files) {
  for (const ent of fs.readdirSync(dirPath, { withFileTypes: true })) {
    const abs = path.join(dirPath, ent.name);
    const relPath = path.join(relBase, ent.name);
    if (ent.isDirectory()) {
      collectDirFiles(abs, relPath, files);
    } else if (ent.isFile()) {
      const content = fs.readFileSync(abs);
      const stat = fs.statSync(abs);
      files.push({
        path: rel(relPath),
        hash: sha256Full(content),
        size: stat.size,
        modified: stat.mtime.toISOString()
      });
    }
  }
}

function parseWorkOrderStatus(content, filename) {
  // Parse Work Order file to extract status
  const statusMatch = content.match(/Status:\s*([^\n]+)/i);
  let status = "draft";

  if (statusMatch) {
    const statusText = statusMatch[1].toLowerCase();
    if (statusText.includes("executed") || statusText.includes("complete")) {
      status = "executed";
    } else if (statusText.includes("approved")) {
      status = "approved";
    } else if (statusText.includes("pending")) {
      status = "pending-approval";
    }
  }

  return status;
}

function parseWorkOrderTitle(content, filename) {
  // Try to extract title from WORK ORDER line or Task ID
  const woMatch = content.match(/WORK ORDER:\s*([^\n]+)/i);
  if (woMatch) return woMatch[1].trim();

  const taskIdMatch = content.match(/Task ID[:\s]+([^\n]+)/i);
  if (taskIdMatch) return taskIdMatch[1].trim();

  // Fallback to filename without extension
  return filename.replace(/\.md$/, "");
}

function collectWorkOrders() {
  const workOrders = [];
  const seenIds = new Set();

  for (const woDir of WO_DIRS) {
    if (!exists(woDir)) continue;

    // Determine relative path prefix for this directory
    const relDir = path.relative(REPO_ROOT, woDir).replaceAll("\\", "/");

    for (const ent of fs.readdirSync(woDir, { withFileTypes: true })) {
      if (!ent.isFile()) continue;
      if (!ent.name.endsWith(".md")) continue;
      // Skip non-WO files (ops notes, playbooks, reports, etc.)
      if (ent.name.startsWith("SYNC_") || ent.name.startsWith("LABELS_")) continue;
      if (ent.name.startsWith("EXECUTOR_") || ent.name.startsWith("BRANCHING_")) continue;
      if (ent.name === "README.md") continue;

      const filePath = path.join(woDir, ent.name);
      const content = fs.readFileSync(filePath, "utf8");
      const stat = fs.statSync(filePath);

      // Check if this looks like a Work Order file
      if (!content.includes("WORK ORDER") && !content.includes("Task ID") && !content.includes("FO-")) continue;

      const id = ent.name.replace(/\.md$/, "");

      // Skip duplicates (prefer first occurrence, which is canonical ops/)
      if (seenIds.has(id)) continue;
      seenIds.add(id);

      const title = parseWorkOrderTitle(content, ent.name);
      const status = parseWorkOrderStatus(content, ent.name);

      workOrders.push({
        id,
        title,
        status,
        lastUpdated: stat.mtime.toISOString(),
        filePath: rel(`${relDir}/${ent.name}`),
        repoUrl: `https://github.com/emkaybarrie/projectExodus/blob/main/${encodeURIComponent(relDir)}/${encodeURIComponent(ent.name)}`
      });
    }
  }

  // Sort by lastUpdated descending
  workOrders.sort((a, b) => new Date(b.lastUpdated) - new Date(a.lastUpdated));

  return workOrders;
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

  const now = new Date().toISOString();
  const commitSha = getGitCommitSha();
  const commitShort = getGitCommitShort();

  // === Generate share-pack.index.json ===
  const headlines = extractHeadlines();
  const fileHashes = collectFileHashes(copied);

  const indexJson = {
    generated: now,
    commit: commitSha,
    commitShort: commitShort,
    headlines: headlines,
    files: fileHashes,
    missing: missing.map(rel),
    signature: "" // Will be filled after
  };

  // Compute signature of the index (excluding signature field)
  const indexBlob = Buffer.from(JSON.stringify(indexJson, null, 2), "utf8");
  indexJson.signature = sha256(indexBlob);

  fs.writeFileSync(OUT_INDEX_JSON, JSON.stringify(indexJson, null, 2), "utf8");

  // === Generate work-orders.index.json ===
  const workOrders = collectWorkOrders();

  const woJson = {
    generated: now,
    commit: commitShort,
    workOrders: workOrders,
    counts: {
      total: workOrders.length,
      draft: workOrders.filter(wo => wo.status === "draft").length,
      pendingApproval: workOrders.filter(wo => wo.status === "pending-approval").length,
      approved: workOrders.filter(wo => wo.status === "approved").length,
      executed: workOrders.filter(wo => wo.status === "executed").length
    }
  };

  fs.writeFileSync(OUT_WO_JSON, JSON.stringify(woJson, null, 2), "utf8");

  // === Generate SHARE_PACK.md (human-readable) ===
  const lines = [];
  lines.push(`# SHARE PACK`);
  lines.push(``);
  lines.push(`Generated: ${now}`);
  lines.push(`Commit: ${commitShort}`);
  lines.push(``);
  lines.push(`## Headlines`);
  lines.push(`- Kernel Version: ${headlines.kernelVersion || "unknown"}`);
  lines.push(`- MyFi Last Updated: ${headlines.myfiLastUpdated || "unknown"}`);
  lines.push(`- MyFi Work Orders: ${headlines.myfiWorkOrders || "unknown"}`);
  lines.push(``);
  lines.push(`## Contents (curated)`);
  lines.push(...copied.map(p => `- ${rel(p)}`));
  lines.push(``);
  if (missing.length) {
    lines.push(`## Missing during generation (non-fatal)`);
    lines.push(...missing.map(p => `- ${rel(p)}`));
    lines.push(``);
  }
  lines.push(`## Work Orders (${workOrders.length} total)`);
  for (const wo of workOrders.slice(0, 10)) {
    lines.push(`- [${wo.status.toUpperCase()}] ${wo.title}`);
  }
  if (workOrders.length > 10) {
    lines.push(`- ... and ${workOrders.length - 10} more`);
  }
  lines.push(``);

  // Hash the manifest so agents can sanity check "same pack".
  const manifestBlob = Buffer.from(lines.join("\n"), "utf8");
  lines.push(`Pack signature: \`${sha256(manifestBlob)}\``);
  lines.push(``);

  fs.writeFileSync(OUT_MD, lines.join("\n"), "utf8");

  console.log(`[share-pack] done. copied=${copied.length} missing=${missing.length} workOrders=${workOrders.length}`);
}

main();
