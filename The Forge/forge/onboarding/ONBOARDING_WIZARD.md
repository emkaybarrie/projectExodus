# Forge Agent Onboarding Wizard (Director + Agent)

This wizard must be followed in order.
If a step cannot be completed, STOP and resolve it before continuing.

---

## Phase 0 — Choose Integration Mode (LOCKED)
- Mode: Hybrid (CLI + Projects UI + Actions later)
- Primary grounding tool: Claude Code (CLI)
- Primary discussion tool: Claude Projects (UI)

---

## Phase 1 — Director Environment Setup

### 1.1 Confirm Claude access
- [ ] Claude account active
- [ ] Projects available in UI
- [ ] Able to install/run Claude Code (CLI)

STOP if any are missing.

---

### 1.2 Install Claude Code (CLI)
- Follow official install instructions
- Verify by running:
  - `claude --version`
  - `claude help`

STOP if CLI does not run locally.

---

## Phase 2 — Repo Preparation (Director)

### 2.1 Repo structure check
Confirm the following exist:
- [ ] /forge/FORGE_MANIFEST.json
- [ ] /myfi/MYFI_MANIFEST.json
- [ ] /myfi/reference/MYFI_MASTER_REFERENCE.docx
- [ ] /myfi/reference/MYFI_REFERENCE_INDEX.json
- [ ] /myfi/MYFI_SNAPSHOT_SEAL.md

STOP if any are missing.

---

### 2.2 Permissions envelope (FIRST RUN)
- Claude read: entire repo
- Claude write: NONE
- Claude outputs: Work Orders only

This is non-negotiable for first run.

---

## Phase 2.5 — VS Code Claude Integration (Optional but Recommended)

### 2.5.1 Install VS Code Extension
- Install the official Claude / Anthropic VS Code extension
- Sign in with the same Claude account used elsewhere

STOP if the extension cannot see the repo workspace.

---

### 2.5.2 Establish Forge Context
Before using Claude in VS Code, ensure the following files exist and are readable:
- /forge/FORGE_CAPSULE.md
- /forge/TASK_WORK_ORDER.md
- /myfi/MYFI_MANIFEST.json
- /myfi/reference/MYFI_MASTER_REFERENCE.docx
- /myfi/reference/MYFI_REFERENCE_INDEX.json

These files define how Claude must behave.

---

### 2.5.3 Usage Rules (VS Code)
When using Claude in VS Code:

Allowed:
- Implement approved Work Orders
- Make small, scoped changes in the current file or surface
- Ask clarifying questions about intent or constraints

Not allowed (unless explicitly approved):
- Cross-cutting refactors
- Architecture changes
- Reference doc edits that change intent
- “While I’m here” improvements

If Claude detects scope creep, it must stop and propose a Work Order.

---

### 2.5.4 Capability Tier
Initial tier for VS Code Claude:
- Read: full repo
- Write: only files related to an approved Work Order
- No autonomous commits

Promotion rules are identical to CLI Claude.

---

## Phase 3 — Forge Initiation (Agent + Director)

### 3.1 Provide Claude onboarding pack
Claude must be given:
- /forge/FORGE_CAPSULE.md
- /forge/TASK_WORK_ORDER.md
- /forge/onboarding/claude/CLAUDE_SYSTEM_PROMPT.md
- /forge/onboarding/claude/FIRST_MISSION_WORK_ORDER.md

---

### 3.2 Run First Mission (Read-only)
Claude executes:
- FO-Claude-01-Reconcile-MyFi-Reference

Expected output:
- Ranked discrepancy report
- One Work Order per discrepancy

STOP if Claude proposes direct edits.

---

## Phase 4 — Director Review

### 4.1 Review outputs
For each Work Order:
- [ ] Approve
- [ ] Reject
- [ ] Defer

Claude is NOT allowed to proceed without explicit approval.

---

## Phase 5 — Capability Promotion (Later)

Only after:
- At least one clean reconciliation pass
- No rule violations

May you:
- Allow doc updates
- Then small code diffs
- Then PR automation

End of wizard.
