// The Forge/forge/ops/scripts/generate-fsp.mjs
// FCL-1: Forge State Pack (FSP) v1 Generator
// Purpose: Generate authoritative runtime state pack for agent context loading
// Trigger: Manual (v1), future: scheduled or event-driven

import fs from "node:fs";
import path from "node:path";

// Schema version for forward compatibility
const FSP_SCHEMA_VERSION = "1.0.0";

const REPO_ROOT = process.cwd();
const OUT_DIR = path.join(REPO_ROOT, "The Forge/forge/exports/cognition");
const OUT_FILE = path.join(OUT_DIR, "forge-state-pack.json");

// Paths to source data
const SHARE_PACK_INDEX = path.join(REPO_ROOT, "The Forge/forge/exports/share-pack/share-pack.index.json");
const WORK_ORDERS_INDEX = path.join(REPO_ROOT, "The Forge/forge/exports/share-pack/work-orders.index.json");
const OBSERVATIONS_FILE = path.join(REPO_ROOT, "The Forge/forge/exports/observations/latest.json");
const FORGE_STATE_FILE = path.join(REPO_ROOT, "The Forge/forge/FORGE_STATE.md");

// === CONFIGURATION ===

// Active Arc: Director-set priority bias
const DEFAULT_ACTIVE_ARC = "Reliability";

// Narrative Anchors v1
const NARRATIVE_ANCHORS = [
  {
    id: "anchor-reliability",
    name: "Reliability",
    description: "System correctness and stability over speed",
    weight: 1.0,
    signals: ["test.pass", "gate.passed", "wo.verified", "smoke.pass"]
  },
  {
    id: "anchor-velocity",
    name: "Velocity",
    description: "Throughput and reduced friction",
    weight: 0.6,
    signals: ["wo.executed", "throughput", "cycle_time"]
  },
  {
    id: "anchor-delight",
    name: "Delight",
    description: "User experience and polish",
    weight: 0.4,
    signals: ["user.feedback", "ux.improvement"]
  }
];

// Genome Classification v1
const STABLE_ARTIFACTS = [
  "FORGE_KERNEL.md",
  "FORGE_STATE.md",
  "FORGE_CAPSULE.md",
  "contracts/WORK_ORDER_LIFECYCLE_CONTRACT.md",
  "contracts/AGENT_ONBOARDING_CONTRACT.md",
  "contracts/FORGE_OS_ROLE_SYSTEM.md",
  "contracts/REPORTING_SIGNALS_CONTRACT.md",
  "ops/E2E_WORKFLOW_PLAYBOOK.md",
  "ops/EXECUTOR_PLAYBOOK.md",
  "ops/DEPLOYMENT_CONTRACT.md"
];

const EXPERIMENTAL_ARTIFACTS = [
  "portal/app.js (M3f, M3g, M3e features)",
  "workflows/forge-observations-commit.yml",
  "workflows/forge-phase-notify.yml",
  "workflows/forge-route-suggest.yml",
  "exports/cognition/* (FCL v1)"
];

// === HELPERS ===

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

function loadJson(p) {
  try {
    const content = fs.readFileSync(p, "utf8");
    return JSON.parse(content);
  } catch (e) {
    console.warn(`[FSP] Failed to load ${p}: ${e.message}`);
    return null;
  }
}

function computeWoStats(workOrders) {
  if (!workOrders?.workOrders) {
    return {
      total: 0,
      byStatus: {},
      missingGates: [],
      stuckWOs: []
    };
  }

  const wos = workOrders.workOrders;
  const byStatus = {};
  const stuckWOs = [];
  const now = new Date();
  const STUCK_THRESHOLD_DAYS = 7;

  for (const wo of wos) {
    const status = wo.status || "unknown";
    byStatus[status] = (byStatus[status] || 0) + 1;

    // Check for stuck WOs (same status > 7 days)
    if (wo.lastUpdated) {
      const lastUpdate = new Date(wo.lastUpdated);
      const daysSinceUpdate = (now - lastUpdate) / (1000 * 60 * 60 * 24);
      if (daysSinceUpdate > STUCK_THRESHOLD_DAYS && status !== "executed") {
        stuckWOs.push({
          id: wo.id,
          status: status,
          daysSinceUpdate: Math.floor(daysSinceUpdate),
          lastUpdated: wo.lastUpdated
        });
      }
    }
  }

  // Detect missing gates (WOs without continuation contract)
  const missingGates = wos
    .filter(wo => wo.status === "executed" && !wo.continuationContract)
    .map(wo => ({ id: wo.id, missing: "continuationContract" }));

  return {
    total: wos.length,
    byStatus,
    missingGates,
    stuckWOs
  };
}

function computeRisks(woStats, observations) {
  const risks = [];

  // Risk: Stuck WOs
  if (woStats.stuckWOs.length > 0) {
    risks.push({
      id: `risk-stuck-wos-${Date.now()}`,
      category: "process",
      description: `${woStats.stuckWOs.length} Work Order(s) stuck > 7 days`,
      severity: woStats.stuckWOs.length > 3 ? "high" : "medium",
      detectedAt: new Date().toISOString(),
      remediation: "Review stuck WOs: " + woStats.stuckWOs.map(w => w.id).join(", "),
      status: "detected"
    });
  }

  // Risk: Missing continuation contracts
  if (woStats.missingGates.length > 0) {
    risks.push({
      id: `risk-missing-gates-${Date.now()}`,
      category: "compliance",
      description: `${woStats.missingGates.length} executed WO(s) lack Continuation Contract`,
      severity: "medium",
      detectedAt: new Date().toISOString(),
      remediation: "Add Continuation Contracts to: " + woStats.missingGates.map(w => w.id).join(", "),
      status: "detected"
    });
  }

  // Risk: Stale observations
  if (observations) {
    const obsTime = new Date(observations.timestamp);
    const hoursSinceObs = (new Date() - obsTime) / (1000 * 60 * 60);
    if (hoursSinceObs > 48) {
      risks.push({
        id: `risk-stale-observations-${Date.now()}`,
        category: "observability",
        description: `Observations are ${Math.floor(hoursSinceObs)} hours old`,
        severity: "low",
        detectedAt: new Date().toISOString(),
        remediation: "Trigger a deploy to refresh observations",
        status: "detected"
      });
    }
  }

  // Risk: Smoke check failures
  if (observations && !observations.smokePass) {
    risks.push({
      id: `risk-smoke-fail-${Date.now()}`,
      category: "deployment",
      description: "Latest deployment smoke checks failed",
      severity: "high",
      detectedAt: new Date().toISOString(),
      remediation: "Review smoke check failures and fix deployment issues",
      status: "detected"
    });
  }

  return risks;
}

// === MAIN GENERATION ===

function generateFSP() {
  console.log("[FSP] Starting Forge State Pack generation...");

  // Load source data
  const sharePack = loadJson(SHARE_PACK_INDEX);
  const workOrders = loadJson(WORK_ORDERS_INDEX);
  const observations = loadJson(OBSERVATIONS_FILE);

  // Compute WO statistics
  const woStats = computeWoStats(workOrders);

  // Compute risks
  const risks = computeRisks(woStats, observations);

  // Determine Active Arc
  // In v1, this is static; future: Director-configurable
  const activeArc = {
    current: DEFAULT_ACTIVE_ARC,
    setBy: "Director",
    setAt: new Date().toISOString(),
    expiresAt: null,
    rationale: "FCL v1 default: stabilization phase"
  };

  // Build FSP
  const fsp = {
    // Metadata
    packType: "ForgeStatePack",
    schemaVersion: FSP_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    generatedBy: "generate-fsp.mjs",
    validUntil: null,
    refreshTrigger: "Manual (v1); Heartbeat or Director request",

    // Active Arc
    activeArc: activeArc,

    // Narrative Anchors
    narrativeAnchors: NARRATIVE_ANCHORS.map(anchor => ({
      ...anchor,
      active: true
    })),

    // Work Order Status
    workOrders: {
      source: exists(WORK_ORDERS_INDEX) ? "work-orders.index.json" : "unavailable",
      lastRefreshed: workOrders?.generated || null,
      ...woStats
    },

    // Observations
    observations: observations ? {
      env: observations.env,
      smokePass: observations.smokePass,
      timestamp: observations.timestamp,
      commitShort: observations.commitShort,
      checksCount: observations.checks?.length || 0
    } : {
      status: "unavailable",
      reason: "observations/latest.json not found"
    },

    // Risks
    risks: risks,

    // Genome Classification
    genome: {
      stable: STABLE_ARTIFACTS,
      experimental: EXPERIMENTAL_ARTIFACTS,
      graduationPending: []
    },

    // Agent Binding Rules
    agentBindingRules: [
      {
        id: "rule-wip-harvest",
        rule: "WIP Harvest Required",
        description: "Before proposing new work, surface all work-in-progress",
        enforcement: "mandatory"
      },
      {
        id: "rule-no-implicit-context",
        rule: "No Implicit Context",
        description: "All context must be loaded from canonical packs",
        enforcement: "mandatory"
      },
      {
        id: "rule-pack-missing-stop",
        rule: "Pack-Missing Detection",
        description: "If required pack unavailable, STOP and request",
        enforcement: "mandatory"
      },
      {
        id: "rule-constitutional-binding",
        rule: "Constitutional Binding",
        description: "Forge Kernel is authoritative; role boundaries are absolute",
        enforcement: "mandatory"
      },
      {
        id: "rule-heartbeat-participation",
        rule: "Heartbeat Participation",
        description: "Agents must respond to Heartbeat requests",
        enforcement: "mandatory"
      }
    ],

    // Source Pack References
    sourceRefs: {
      sharePack: exists(SHARE_PACK_INDEX) ? SHARE_PACK_INDEX.replace(REPO_ROOT, "") : null,
      workOrders: exists(WORK_ORDERS_INDEX) ? WORK_ORDERS_INDEX.replace(REPO_ROOT, "") : null,
      observations: exists(OBSERVATIONS_FILE) ? OBSERVATIONS_FILE.replace(REPO_ROOT, "") : null
    }
  };

  // Ensure output directory exists
  ensureDir(OUT_DIR);

  // Write FSP
  fs.writeFileSync(OUT_FILE, JSON.stringify(fsp, null, 2), "utf8");

  console.log(`[FSP] Forge State Pack written to: ${OUT_FILE}`);
  console.log(`[FSP] Active Arc: ${fsp.activeArc.current}`);
  console.log(`[FSP] Work Orders: ${fsp.workOrders.total} total`);
  console.log(`[FSP] Risks detected: ${fsp.risks.length}`);

  return fsp;
}

// Run
generateFSP();
