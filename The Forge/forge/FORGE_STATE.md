📄 FORGE_STATE.md

Status: Canonical
Audience: All agents
Last updated: 2026-01-24 (Post Foundational Alignment Pack)

---

## Network State

### Governance Model
**Active Model:** Model 3 — Forge as Institutional OS, MyFi as Flagship Entity

See: [Forante Kernel](../../Forante/FORANTE_KERNEL.md) for constitutional governance.

### Registered Entities

| Entity | Integration Tier | Status | Role |
|--------|-----------------|--------|------|
| MyFi | Tier 2 | Active | Flagship / Proving Ground |

### Flagship Entity
**MyFi** — The primary proving ground for Forge evolution. Forge improvements are validated through MyFi development. MyFi's success is tied to Forge's success, but Forge integrity takes precedence.

### Portal Status
- **Forge Portal:** ✅ Active (GitHub Pages)
- **Entity Registry:** ✅ Initialized (`portal/data/entities.json`)

### Constitutional Documents Status
- **Forante Kernel:** ✅ Established
- **Forante Index:** ✅ Established
- **Forge Kernel:** ✅ Aligned to Model 3
- **Operating Model Lanes:** ✅ Defined
- **Share Pack:** ✅ Includes Forante layer

---

1. Current Institutional Mode

The MyFi Forge is operating in Dual-Track Mode.

Track A: Forge construction and institutional hardening

Track B: MyFi product development and iteration

Neither track is subordinate.
Agents must always consider whether work advances:

the product,

the institution,

or both.

If a task advances neither, it must be challenged.

2. Agent Availability Assumptions

The Forge must remain operational under the following conditions:

Repo-aware Executor (Claude Code): ✅ Onboarded and executing WOs

Architect (non-repo AI): available

Director (human): available but not always fully specified

Agents must not assume:

direct repo access

full code visibility

or synchronous human oversight

Process guidance and enforcement must function regardless.

3. Active Focus Areas

The Forge recognises the following as active and legitimate work domains:

3.1 Institutional Build-Out

✅ Forge artifacts defined (Kernel, Capsule, State)

✅ Process rules codified (Work Order lifecycle)

✅ Claude Code onboarded via EXECUTOR_PLAYBOOK.md

✅ Forge Capsule exists (portable truth layer)

✅ Forge Portal live on GitHub Pages (mobile-first governance UI)

✅ Execute loop implemented (S3: /execute → Execution Pack → Executor Queue)

✅ Branch discipline established (dev → PR → main)

✅ Share Pack auto-refresh on deploy

3.2 MyFi Product Work

Hub / Vitals architecture

Quests and Journeys

UI systems (Surfaces / Slots / Parts)

Behavioural mechanics (Essence, Vitals, Shields)

Demo and pilot readiness

Work in either domain is allowed, provided it follows Forge process.

4. Explicit Non-Goals (Temporary)

Until further notice, the Forge must not prioritise:

Large-scale refactors without Executor oversight

Performance micro-optimisation

Visual polish beyond functional clarity

New subsystems without clear spec lineage

This is a stabilisation phase, not an expansion phase.

5. Known Risks & Watch Areas

Agents must be alert to the following risks:

Process drift: reverting to free-form prompting or ad-hoc decisions

Over-formalisation: process becoming heavier than value delivered

Agent overreach: AI making irreversible decisions without approval

Vision dilution: MyFi mechanics drifting from behavioural intent

If detected, agents must pause work and surface the risk explicitly.

6. Allowed Agent Behaviour (Without Claude)

In the absence of a repo-aware Executor:

Agents may:

design specs

critique architecture

propose refactors conceptually

prepare work orders

generate portable artifacts

Agents must not:

assume code reality without evidence

claim implementation correctness

silently invent APIs or structures

All outputs must be clearly labelled as:

Design

Spec

Proposal

or Process Artifact

7. Claude Code Onboarding Status

✅ **ONBOARDED** — Claude Code is now the active repo-aware Executor.

Criteria met:
- ✅ Forge Kernel is stable
- ✅ Forge State is current
- ✅ Forge Capsule exists and is up to date
- ✅ Work Orders are consistently used
- ✅ Specs exist for Hub workflow (I1, I2)
- ✅ EXECUTOR_PLAYBOOK.md provides execution protocol

Claude executes Work Orders via:
1. Executor Queue: `github.com/.../issues?q=label:ready-for-executor`
2. Parse EXECUTION PACK comment for scope
3. Follow EXECUTOR_PLAYBOOK.md discipline

8. Next Required Action (Self-Signposted)

The Forge is now operational with Claude Code executing Work Orders.

**Completed Infrastructure:**
- ✅ FORGE_CAPSULE.md — Portable truth layer
- ✅ Forge Portal — Mobile governance UI
- ✅ Execute Loop (S3) — /execute → Execution Pack → Executor Queue
- ✅ Share Pack — Auto-refresh indices on deploy

**Next Session Menu (from NEXT_SESSION_WORK_ORDERS_MENU.md):**
- Track A: Forge Automation (Label creation, PR bot, metrics)
- Track B: MyFi Product Dev (Quest surface, Vitals deep-dive)
- Track C: Stability (WO consolidation, local dev setup)

**Pending PR:**
- `sync/dev-to-main-s3-and-fixes` — Merge to deploy auth fix and S3 features

---

**Work Orders Executed This Session:**
- FO-Forge-S3-Execute-Loop-Mobile-Repo-Agent
- FO-Forge-W1-Session-WindDown-Integrity-Test-And-Next-Menu
- Share Pack Refresh (Forge Compliant)

End of Forge State