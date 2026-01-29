// The Forge/forge/ops/scripts/make-observation.mjs
// P9: Reporter Phase Minimal — Generate ephemeral observation data
// Purpose: Produce latest.json for Portal to display PASS/FAIL status
// Strategy: EPHEMERAL — generated at deploy time, not committed

import fs from "node:fs";
import path from "node:path";

// Schema version for forward compatibility
const OBSERVATION_SCHEMA_VERSION = "1.0.0";

// Configuration from environment or CLI args
const config = {
  envName: process.env.ENV_NAME || process.argv[2] || "unknown",
  deployedBranch: process.env.DEPLOYED_BRANCH || process.argv[3] || "unknown",
  commitSha: process.env.COMMIT_SHA || process.argv[4] || "unknown",
  baseUrl: process.env.BASE_URL || process.argv[5] || "",
  timestamp: process.env.TIMESTAMP_ISO || new Date().toISOString()
};

const REPO_ROOT = process.cwd();
const OUT_DIR = path.join(REPO_ROOT, "The Forge/forge/exports/observations");
const OUT_FILE = path.join(OUT_DIR, "latest.json");

// Bounded check list — prevents unbounded growth
const SMOKE_CHECKS = [
  {
    name: "portal",
    localPath: "The Forge/forge/portal/index.html",
    description: "Portal index file exists"
  },
  {
    name: "sharePackIndex",
    localPath: "The Forge/forge/exports/share-pack/share-pack.index.json",
    description: "Share pack index exists"
  },
  {
    name: "workOrdersIndex",
    localPath: "The Forge/forge/exports/share-pack/work-orders.index.json",
    description: "Work orders index exists"
  }
];

function exists(p) {
  try {
    fs.accessSync(p);
    return true;
  } catch {
    return false;
  }
}

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function runLocalChecks() {
  // Local file existence checks (during build, before deploy)
  const checks = [];
  let allPass = true;

  for (const check of SMOKE_CHECKS) {
    const fullPath = path.join(REPO_ROOT, check.localPath);
    const fileExists = exists(fullPath);

    checks.push({
      name: check.name,
      ok: fileExists,
      path: check.localPath,
      note: fileExists ? "File exists" : "File not found"
    });

    if (!fileExists) {
      allPass = false;
    }
  }

  return { checks, allPass };
}

function generateNotes(checks, allPass) {
  if (allPass) {
    return `All ${checks.length} smoke checks passed`;
  }

  const failed = checks.filter(c => !c.ok);
  return `${failed.length} of ${checks.length} checks failed: ${failed.map(c => c.name).join(", ")}`;
}

function main() {
  console.log("[make-observation] Starting observation generation...");
  console.log(`  ENV_NAME: ${config.envName}`);
  console.log(`  DEPLOYED_BRANCH: ${config.deployedBranch}`);
  console.log(`  COMMIT_SHA: ${config.commitSha}`);
  console.log(`  BASE_URL: ${config.baseUrl || "(not set)"}`);
  console.log(`  TIMESTAMP: ${config.timestamp}`);

  // Run local checks
  const { checks, allPass } = runLocalChecks();

  // Build observation object
  const observation = {
    schemaVersion: OBSERVATION_SCHEMA_VERSION,
    env: config.envName,
    deployedBranch: config.deployedBranch,
    timestamp: config.timestamp,
    commitSha: config.commitSha,
    commitShort: config.commitSha.substring(0, 7),
    baseUrl: config.baseUrl,
    smokePass: allPass,
    checks: checks,
    notes: generateNotes(checks, allPass)
  };

  // Ensure output directory exists
  ensureDir(OUT_DIR);

  // Write observation file
  fs.writeFileSync(OUT_FILE, JSON.stringify(observation, null, 2), "utf8");

  console.log(`[make-observation] Observation written to: ${OUT_FILE}`);
  console.log(`[make-observation] Smoke Pass: ${allPass ? "PASS ✓" : "FAIL ✗"}`);

  // Exit with appropriate code
  if (!allPass) {
    console.log("[make-observation] WARNING: Some checks failed, but continuing deployment");
    // Don't exit with error — let deployment proceed, portal will show FAIL status
  }

  return observation;
}

main();
