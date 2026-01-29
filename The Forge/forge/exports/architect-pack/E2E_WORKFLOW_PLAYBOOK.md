# E2E Workflow Playbook

Status: Canonical
Last Updated: 2026-01-25
Scope: Director-triggered end-to-end workflow guidance (precursor to automation)

---

## Purpose

This playbook guides the Director through a complete Forge workflow:

**Director Intent → Work Order → Role Handoffs → Execution → Verification → Deployment → Reporting → Evolution**

This is the **canonical way to work** until automation Work Orders are approved. The workflow is "human-triggered, role-driven" — roles/agents align around this objective.

---

## E2E Workflow Phases

The workflow follows the Work Order Lifecycle Contract states:

```
1. Draft        → Director/Architect creates Work Order
2. Approved     → Director approves, Forge routes to Executor
3. Executing    → Executor implements per WO scope
4. Verified     → Verifier–Tester validates acceptance criteria
5. Deployed Dev → Changes deployed to dev environment
6. Promoted     → Director approves for production
7. Deployed Prod→ Changes deployed to production
8. Observed     → Reporter captures baseline metrics
9. Evolved      → Evolution Agent proposes improvements (optional)
```

---

## Phase-by-Phase Checklist

### Phase 1: Draft

**Role:** Director / Architect

**Actions:**
- [ ] Capture intent clearly (WHY this work exists)
- [ ] Define scope (WHAT is to change)
- [ ] Write acceptance criteria (HOW we know it's done)
- [ ] Specify allowed files/paths (WHERE changes are permitted)
- [ ] Identify required capabilities (WHO can execute)

**Artifacts Produced:**
- Work Order document (in `work-orders/` or `ops/`)
- Entry in work-orders.index.json (status: draft)

**Director Prompt:**
> "Is this Work Order complete enough for an agent to execute without clarification?"

---

### Phase 2: Approved

**Role:** Director (approval) → Forge (routing)

**Actions:**
- [ ] Director reviews WO for completeness
- [ ] Director marks WO as "Approved"
- [ ] Forge routes to eligible Executor based on required capabilities

**Artifacts Produced:**
- WO status updated to "approved"
- Agent assignment (explicit or implicit)

**Director Prompt:**
> "Does an eligible agent exist for this WO? If not, should I onboard one or wait?"

**If No Eligible Agent:**
- WO enters `blocked` state
- Director must: onboard new agent, wait for availability, or invoke M2/M3 override

---

### Phase 3: Executing

**Role:** Executor (Builder)

**Actions:**
- [ ] Read WO document fully
- [ ] Branch from `dev`
- [ ] Implement changes per scope
- [ ] Commit with clear messages
- [ ] Open PR (if applicable)
- [ ] Declare execution complete

**Artifacts Produced:**
- Code changes / documentation updates
- Commits on feature branch
- PR (if applicable)
- Agent provenance recorded

**Executor Pack Contents:**
- WO id + title
- Required capabilities
- Links to: Kernel, Onboarding Contract, Lifecycle Contract, Signals Contract
- Reminder: Non-Regression Principle + Acceptance Criteria Supremacy
- Closure checklist

**If Blocked:**
- Executor requests clarification
- WO enters `blocked` state until resolved
- All clarification requests logged

---

### Phase 4: Verified/Tested

**Role:** Verifier–Tester (Guardian)

**Actions:**
- [ ] Review changes against acceptance criteria
- [ ] Run test suites (if available)
- [ ] Validate no regression introduced
- [ ] Check provenance is recorded
- [ ] Pass or reject

**Artifacts Produced:**
- Test results
- Acceptance criteria checklist (pass/fail per criterion)
- Rejection notes (if applicable)

**Blocking Authority:** YES — Can reject and return to Executing

**Director Prompt (if rejected):**
> "What unmet criteria caused rejection? Is the WO scope clear?"

---

### Phase 5: Deployed (Dev)

**Role:** Executor / Automation

**Actions:**
- [ ] Merge PR to `dev` (or direct commit if no PR)
- [ ] Trigger dev deployment
- [ ] Verify dev deployment successful
- [ ] Record deployment URL/logs

**Artifacts Produced:**
- Deployment logs
- Dev environment URL
- Commit hash on `dev`

**If Deployment Fails:**
- WO enters `blocked` state
- Executor investigates and fixes
- Re-attempt deployment

---

### Phase 6: Promoted

**Role:** Director

**Actions:**
- [ ] Review dev deployment
- [ ] Decide if ready for production
- [ ] Approve or hold promotion

**Artifacts Produced:**
- Promotion decision (approved / held)
- Any conditions attached

**Director Prompt:**
> "Is dev behavior acceptable? Any concerns before production?"

---

### Phase 7: Deployed (Prod)

**Role:** Executor / Automation

**Actions:**
- [ ] Trigger prod deployment workflow
- [ ] Verify prod deployment successful
- [ ] Record deployment URL/logs

**Artifacts Produced:**
- Deployment logs
- Prod environment URL
- Commit hash on `main`

**If Deployment Fails:**
- WO enters `blocked` state
- Escalate to Director
- Rollback if necessary

---

### Phase 8: Observed

**Role:** Reporter

**Actions:**
- [ ] Capture baseline metrics post-deployment
- [ ] Record initial observations
- [ ] Track over defined observation period

**Artifacts Produced:**
- Baseline metrics
- Initial observations
- Time-stamped signals

**Observation Period:**
- Minimum: 24 hours for significant changes
- Reporter determines when baseline is sufficient

---

### Phase 9: Evolved (Optional)

**Role:** Evolution Agent

**Actions:**
- [ ] Review Reporter signals
- [ ] Identify improvement opportunities
- [ ] Draft evolution proposal (if warranted)
- [ ] Submit for Director consideration

**Artifacts Produced:**
- Evolution proposal (references Reporter signals)
- Or: explicit "no evolution needed" determination

---

## What To Do When Stuck

### Missing Eligible Agent Capability

1. Check AGENT_ONBOARDING_CONTRACT.md for required capability profile
2. Options:
   - **Wait** for an eligible agent to become available
   - **Onboard** a new agent with required capabilities
   - **M2/M3 Override** (Director assumes role temporarily with logging + expiry)
3. Director must decide which path

### Verifier Block (Rejection)

1. Read rejection notes carefully
2. Identify specific unmet acceptance criteria
3. Options:
   - **Fix** the issues and re-submit for verification
   - **Amend** acceptance criteria (Director only, before re-execution)
   - **Split** WO if scope was too large
4. Return to Executing phase

### Failed Deployment

1. Check deployment logs for error
2. Options:
   - **Fix** the deployment issue (may require new WO)
   - **Rollback** if production is affected
   - **Escalate** to Director for decision
3. Record failure as Reporter signal

### Ambiguous Scope

1. Pause execution immediately
2. File clarification request
3. WO enters `blocked` state
4. Director provides clarification
5. Resume from blocking point

---

## Constitutional Binding on Onboarding

**All agents must operate within the Forge Context Envelope.**

Before executing any work, agents must be bound to:
- **Forge Kernel** — Canonical process law
- **Role System** — Capability-to-role mapping
- **Active Laws** — Acceptance Criteria Supremacy, Forge Evolution, Agent Provenance
- **Reporting Requirements** — Structured output expectations
- **Non-Regression Principle** — Cannot weaken constitutional guarantees

**Model-native conventions (system prompts, init files, etc.) are wrapped by this envelope.**

Agents that violate constitutional binding:
- Have artifacts rejected by Verifier–Tester
- Trigger Director escalation
- Are logged as `agent.constitutional.violation` signal

See: [AGENT_ONBOARDING_CONTRACT.md](../contracts/AGENT_ONBOARDING_CONTRACT.md) for full requirements.

---

## Agent Pack Template (Per Phase)

When copying an Agent Pack for a specific phase, include:

```
# Agent Pack: [WO-ID] — Phase: [PHASE_NAME]

## Work Order
- ID: [WO_ID]
- Title: [WO_TITLE]
- Status: [STATUS]

## Phase Requirements
- Role: [REQUIRED_ROLE]
- Capabilities: [CAPABILITY_PROFILE]

## Constitutional Reminders
- Acceptance Criteria Supremacy: Criteria are the binding definition of done
- Non-Regression Principle: Cannot weaken constitutional guarantees
- Provenance Required: Record agent type, name, mode at completion

## Canonical References
- Forge Kernel: The Forge/forge/FORGE_KERNEL.md
- Agent Onboarding: The Forge/forge/contracts/AGENT_ONBOARDING_CONTRACT.md
- WO Lifecycle: The Forge/forge/contracts/WORK_ORDER_LIFECYCLE_CONTRACT.md
- Reporting Signals: The Forge/forge/contracts/REPORTING_SIGNALS_CONTRACT.md

## Closure Checklist
- [ ] All acceptance criteria addressed
- [ ] Provenance recorded
- [ ] Artifacts produced per phase requirements
- [ ] No regressions introduced
- [ ] Handoff ready for next phase
```

---

## Cross-References

- [WORK_ORDER_LIFECYCLE_CONTRACT.md](../contracts/WORK_ORDER_LIFECYCLE_CONTRACT.md) — State machine definition
- [AGENT_ONBOARDING_CONTRACT.md](../contracts/AGENT_ONBOARDING_CONTRACT.md) — Capability axes and binding
- [FORGE_OS_ROLE_SYSTEM.md](../contracts/FORGE_OS_ROLE_SYSTEM.md) — Role definitions
- [REPORTING_SIGNALS_CONTRACT.md](../contracts/REPORTING_SIGNALS_CONTRACT.md) — Signal categories
- [DEPLOYMENT_CONTRACT.md](./DEPLOYMENT_CONTRACT.md) — Dev/Prod deployment rules

---

End of Playbook.
