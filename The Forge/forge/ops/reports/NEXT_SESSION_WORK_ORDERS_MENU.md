# Next Session Work Orders Menu

**Generated:** 2026-01-24
**Purpose:** Draft WOs for the Director to pick from in the next session
**Source:** FO-Forge-W1-Session-WindDown-Integrity-Test-And-Next-Menu

---

## Track 1: Forge Automation / Portal

### WO-F1: Work Order Storage Consolidation

**Task ID:** FO-Forge-F1-Work-Order-Consolidation
**Type:** refactor + automation

**Intent:** Eliminate Work Order fragmentation by consolidating all WOs into a single canonical location and updating tooling.

**Scope:**
- Move all WOs from `Work Orders/` and `work-orders/` to `ops/`
- Update `refresh-share-pack.mjs` to scan only `ops/`
- Archive truly legacy WOs in `ops/archive/`
- Verify portal and indices still function

**Allowed:** `The Forge/forge/ops/**`, `The Forge/forge/Work Orders/**`, `The Forge/forge/work-orders/**`, refresh-share-pack.mjs
**Forbidden:** MyFi code, Kernel rewrites, workflow changes

**Success Criteria:**
- Single WO location exists
- Share pack indices reflect all active WOs
- Portal loads WO list correctly

**Why it matters:** Fragmentation causes confusion and index inconsistencies. Clean structure = reliable automation.

---

### WO-F2: GitHub Labels Automation

**Task ID:** FO-Forge-F2-GitHub-Labels-Setup
**Type:** ops-automation

**Intent:** Create all required GitHub labels for the Forge execution pipeline.

**Scope:**
- Create labels via gh CLI: `ready-for-executor`, `executing`, `executed`, `blocked`
- Verify existing labels: `work-order`, `approved`, `pending-approval`
- Document label colors and descriptions
- Test `/execute` flow end-to-end

**Allowed:** GitHub label settings, documentation
**Forbidden:** Workflow changes, code changes

**Success Criteria:**
- All 7 labels exist with correct colors
- `/execute` workflow succeeds on test WO
- Execution Pack comment appears correctly

**Why it matters:** Labels are the state machine for WO execution. Without them, automation fails silently.

---

### WO-F3: Portal WO Creation Wizard Enhancement

**Task ID:** FO-Forge-F3-Portal-WO-Wizard-V2
**Type:** implementation

**Intent:** Improve the Create Work Order wizard with better field validation and GitHub Issue form prefilling.

**Scope:**
- Add client-side validation for required fields
- Improve Task ID format suggestion (auto-generate based on type)
- Add "Preview" step before GitHub redirect
- Handle popup blocker gracefully

**Allowed:** `The Forge/forge/portal/app.js`, `styles.css`
**Forbidden:** Backend changes, workflow changes

**Success Criteria:**
- Wizard validates all required fields
- Task ID format is suggested automatically
- Preview shows what will be created
- Error states are clear and actionable

**Why it matters:** Lower friction = more WOs = better governance adoption.

---

### WO-F4: Portal Offline/Error State Handling

**Task ID:** FO-Forge-F4-Portal-Offline-Graceful
**Type:** implementation

**Intent:** Ensure the Portal gracefully handles network failures and missing indices.

**Scope:**
- Add retry logic with exponential backoff
- Show cached data if available
- Distinguish "loading" vs "offline" vs "error" states
- Add "Last successful fetch" timestamp

**Allowed:** `The Forge/forge/portal/app.js`, `styles.css`
**Forbidden:** Backend changes

**Success Criteria:**
- Portal shows meaningful state when offline
- Retry button works
- Cached data displayed when available

**Why it matters:** Mobile governance needs to work on flaky networks.

---

## Track 2: MyFi Product Dev

### WO-M1: Quests Surface Specification

**Task ID:** FO-MyFi-C4-Quests-Surface-Spec
**Type:** spec-sync

**Intent:** Define the Quests surface contract following the Surfaces/Slots/Parts model.

**Scope:**
- Define Quest data model (VM contract)
- Define Quests surface layout (slots)
- Define required Parts (QuestCard, QuestList, QuestDetail)
- Define Journey triggers for quest interactions

**Allowed:** `The Forge/myfi/specs/**`, new contract files
**Forbidden:** Implementation code

**Success Criteria:**
- Quest VM contract defined
- Quests surface.json specified
- Part contracts for quest UI defined
- Journey triggers documented

**Why it matters:** Quests is the next major surface after Hub. Spec-first prevents drift.

---

### WO-M2: Settings Surface Specification

**Task ID:** FO-MyFi-C5-Settings-Surface-Spec
**Type:** spec-sync

**Intent:** Define the Settings surface for user preferences and account management.

**Scope:**
- Define Settings data model
- Define surface layout (sections: Account, Preferences, About)
- Define required Parts (SettingsSection, ToggleRow, LinkRow)
- Define logout/auth flows

**Allowed:** `The Forge/myfi/specs/**`
**Forbidden:** Implementation

**Success Criteria:**
- Settings VM contract defined
- Surface layout specified
- Part contracts defined

**Why it matters:** Settings is required for MVP launch (logout, preferences).

---

### WO-M3: Start Surface + Auth Flow

**Task ID:** FO-MyFi-I3-Start-Surface-Auth
**Type:** implementation

**Intent:** Implement the Start surface (login/landing) within the canonical codebase.

**Scope:**
- Implement Start surface with login form
- Wire Firebase Auth (existing auth.js patterns)
- Redirect to Hub on successful auth
- Handle auth errors gracefully

**Allowed:** `ProjectMyFi_vLatest/src/surfaces/start/**`, `src/core/session.js`
**Forbidden:** Legacy code modifications

**Success Criteria:**
- Start surface loads
- Login works with Firebase
- Successful login redirects to Hub
- Auth state persists

**Why it matters:** Can't have a product without login.

---

### WO-M4: Financial Data Integration Spike

**Task ID:** FO-MyFi-R1-Financial-Data-Spike
**Type:** research

**Intent:** Investigate how to integrate real financial data (TrueLayer or similar) into the vitals system.

**Scope:**
- Research TrueLayer API capabilities
- Map financial events to vitals pool changes
- Document security/privacy considerations
- Propose integration architecture

**Allowed:** Documentation only
**Forbidden:** Implementation, API key setup

**Success Criteria:**
- API capabilities documented
- Mapping proposal created
- Security considerations listed
- Architecture sketch provided

**Why it matters:** Real data is the core value prop. Need to understand integration path.

---

## Track 3: Stability / Refactor / Compliance

### WO-S1: Local Development Setup Documentation

**Task ID:** FO-Forge-S4-Local-Dev-Setup
**Type:** docs-only

**Intent:** Document complete local development setup for Forge Portal and MyFi.

**Scope:**
- Node.js installation instructions (Windows/Mac/Linux)
- VS Code recommended extensions
- Live Server setup
- Local testing workflow
- Troubleshooting common issues

**Allowed:** `BRANCHING_PLAYBOOK.md`, new docs in `ops/`
**Forbidden:** Code changes

**Success Criteria:**
- Step-by-step setup guide exists
- Works on Windows (primary) and Mac
- Troubleshooting section covers common issues

**Why it matters:** Can't develop if you can't run locally.

---

### WO-S2: Share Pack Script Robustness

**Task ID:** FO-Forge-S5-Share-Pack-Robustness
**Type:** refactor

**Intent:** Improve refresh-share-pack.mjs error handling and reporting.

**Scope:**
- Add try/catch around file operations
- Report which files failed and why
- Add --verbose flag for debugging
- Add --dry-run flag for testing

**Allowed:** `refresh-share-pack.mjs`
**Forbidden:** Schema changes, new dependencies

**Success Criteria:**
- Script never exits silently on error
- Failed files are reported
- --verbose shows detailed progress
- --dry-run shows what would happen

**Why it matters:** Silent failures in automation cause hours of debugging.

---

### WO-S3: PRODUCT_STATE.md Auto-Update Exploration

**Task ID:** FO-Forge-R2-Product-State-Auto
**Type:** research

**Intent:** Explore automating PRODUCT_STATE.md updates when WOs are executed.

**Scope:**
- Analyze what parts of PRODUCT_STATE could be generated
- Propose update triggers (WO completion? Manual?)
- Consider version control implications
- Document tradeoffs

**Allowed:** Documentation
**Forbidden:** Implementation

**Success Criteria:**
- Automation feasibility assessed
- Tradeoffs documented
- Recommendation made

**Why it matters:** Manual updates risk drift. Auto-updates risk noise.

---

### WO-S4: Forge Kernel Review

**Task ID:** FO-Forge-A1-Kernel-Review
**Type:** audit

**Intent:** Review FORGE_KERNEL.md for completeness and consistency with current implementation.

**Scope:**
- Compare Kernel rules with actual workflow behavior
- Identify any rules not enforced
- Identify any enforced behavior not in Kernel
- Propose updates (don't implement)

**Allowed:** Read all files, create audit report
**Forbidden:** Kernel modifications

**Success Criteria:**
- Audit report created
- Gaps listed with severity
- Update proposals documented

**Why it matters:** Kernel is the constitution. If it's wrong, everything drifts.

---

## Quick Reference Table

| ID | Track | Type | Priority | Effort |
|----|-------|------|----------|--------|
| F1 | Forge | refactor | High | Medium |
| F2 | Forge | ops | High | Low |
| F3 | Forge | impl | Medium | Medium |
| F4 | Forge | impl | Medium | Medium |
| M1 | MyFi | spec | High | Medium |
| M2 | MyFi | spec | Medium | Low |
| M3 | MyFi | impl | High | High |
| M4 | MyFi | research | Low | Low |
| S1 | Stability | docs | High | Low |
| S2 | Stability | refactor | Medium | Low |
| S3 | Stability | research | Low | Low |
| S4 | Stability | audit | Medium | Medium |

---

## Recommended Next Session Picks

**If time is short (1-2 WOs):**
1. **F2: GitHub Labels Setup** — Unblocks execution pipeline
2. **S1: Local Dev Setup** — Unblocks contributors

**If time is medium (3-4 WOs):**
1. F2: Labels Setup
2. F1: WO Consolidation
3. S1: Local Dev Setup
4. M1: Quests Spec

**If time is long (full session):**
1. F2: Labels Setup
2. F1: WO Consolidation
3. M1: Quests Spec
4. M3: Start Surface
5. S1: Local Dev Setup

---

**Menu Generated By:** FO-Forge-W1-Session-WindDown-Integrity-Test-And-Next-Menu
