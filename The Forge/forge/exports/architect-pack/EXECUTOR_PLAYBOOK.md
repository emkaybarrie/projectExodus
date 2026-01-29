# Executor Playbook

**Status:** Canonical
**Audience:** Claude Code agents, Developers executing Work Orders
**Purpose:** Standard operating procedure for executing Forge Work Orders

---

## Overview

This playbook defines the execution discipline for Work Orders in the Forge system. When you (Claude or a developer) pick up a Work Order from the executor queue, follow these steps exactly.

---

## Finding Work Orders

### Executor Queue URL

```
https://github.com/emkaybarrie/projectExodus/issues?q=is%3Aissue+is%3Aopen+label%3Aready-for-executor
```

### What You'll See

Work Orders in the queue have:
- Label: `ready-for-executor`
- An **EXECUTION PACK** comment containing all scope information
- Previously applied labels: `work-order`, `approved`

---

## Execution Steps

### Step 1: Claim the Work Order

Before starting work, claim the WO to prevent duplicate execution:

```
1. Apply label: `executing`
2. Remove label: `ready-for-executor`
3. Post comment: "🤖 Execution started by [your name/agent]"
```

### Step 2: Parse the Execution Pack

Find the **EXECUTION PACK** comment (posted by the `/execute` workflow). Extract:

| Field | Purpose |
|-------|---------|
| **Objective** | What must be achieved |
| **Allowed Paths** | Files/directories you MAY modify |
| **Forbidden Paths** | Files/directories you MUST NOT touch |
| **Success Criteria** | How to verify completion |
| **Notes** | Additional context |

### Step 3: Verify Scope

Before writing any code:

1. **Read the Objective** — Understand the WHY
2. **Check Allowed Paths** — Only modify listed files/patterns
3. **Check Forbidden Paths** — Never touch these, even if "helpful"
4. **Review Success Criteria** — Know what "done" looks like

### Step 4: Execute the Work

Perform the work as specified:

- Stay within allowed paths
- Follow existing code patterns in the codebase
- Make minimal changes needed to satisfy the objective
- Do not add unrequested features or "improvements"

### Step 5: Report Completion

On successful completion:

```
1. Apply label: `executed`
2. Remove label: `executing`
3. Post completion comment with:
   - Summary of changes made
   - Files modified
   - Link to PR (if applicable)
   - Success criteria verification
```

**Completion Comment Template:**

```markdown
## ✅ Execution Complete

**Work Order:** [WO-ID]
**Status:** Executed

### Changes Made
- [Bullet list of changes]

### Files Modified
- `path/to/file1.js`
- `path/to/file2.css`

### Success Criteria Verification
- [x] Criteria 1 — verified by [method]
- [x] Criteria 2 — verified by [method]

### PR/Commit
[Link to PR or commit]

---
_Executed by [agent name] • [timestamp]_
```

---

## Handling Blockers

If you cannot complete the Work Order:

### Step 1: Apply Blocked Label

```
1. Keep label: `executing` (for visibility)
2. Apply label: `blocked`
```

### Step 2: Post Blocker Comment

```markdown
## 🔴 Execution Blocked

**Work Order:** [WO-ID]
**Blocker:** [Brief description]

### Details
[Explain what's blocking execution]

### Suggested Resolution
[What needs to happen to unblock]

### Partial Progress (if any)
[What was completed before blocking]

---
_Blocked at [timestamp] by [agent name]_
```

### Step 3: Await Director Input

Do not proceed until the Director or a maintainer:
- Resolves the blocker
- Updates the Work Order scope
- Removes the `blocked` label

---

## Scope Enforcement

### ALWAYS Allowed

- Reading any file (for context)
- Files explicitly listed in **Allowed Paths**
- Creating new files within allowed directories
- Modifying package.json if dependencies are needed AND allowed

### NEVER Allowed

- Files listed in **Forbidden Paths**
- Core infrastructure unless explicitly allowed:
  - `.github/workflows/*` (unless WO is about workflows)
  - `The Forge/forge/FORGE_KERNEL.md`
  - Branch protection / repo settings
- Deleting files unless explicitly requested
- "Helpful" refactors outside the WO scope

### When in Doubt

If unclear whether something is in scope:
1. Post a clarifying comment on the issue
2. Wait for Director response
3. Do NOT proceed with assumptions

---

## Label State Machine

```
                      ┌─────────────────────────┐
                      │   ready-for-executor    │
                      │   (queued for pickup)   │
                      └───────────┬─────────────┘
                                  │
                      ┌───────────▼─────────────┐
                      │       executing         │
                      │   (work in progress)    │
                      └───────────┬─────────────┘
                                  │
              ┌───────────────────┴───────────────────┐
              │                                       │
   ┌──────────▼──────────┐               ┌───────────▼───────────┐
   │      executed       │               │       blocked         │
   │   (work complete)   │               │  (awaiting resolution)│
   └─────────────────────┘               └───────────────────────┘
```

---

## Quick Reference

| Action | Labels to Apply | Labels to Remove |
|--------|-----------------|------------------|
| Start execution | `executing` | `ready-for-executor` |
| Complete successfully | `executed` | `executing` |
| Hit a blocker | `blocked` | (keep `executing`) |
| Blocker resolved | (remove `blocked`) | `blocked` |

---

## For Claude Code Agents

When invoked to execute a Work Order:

1. **First message**: Acknowledge the WO and apply `executing` label
2. **Parse**: Read the EXECUTION PACK comment carefully
3. **Plan**: Create a todo list of changes needed
4. **Verify scope**: Double-check allowed/forbidden paths
5. **Execute**: Make changes within scope
6. **Test**: Verify success criteria if possible
7. **Report**: Post completion comment and apply `executed` label

### Example First Message

```
I'm picking up Work Order FO-MyFi-I3-Feature from the executor queue.

Applying `executing` label and removing `ready-for-executor`.

Parsing the Execution Pack:
- Objective: [parsed objective]
- Allowed Paths: [parsed paths]
- Forbidden Paths: [parsed paths]

Creating execution plan...
```

---

**Created by:** FO-Forge-S3-Execute-Loop-Mobile-Repo-Agent
**Date:** 2026-01-24
