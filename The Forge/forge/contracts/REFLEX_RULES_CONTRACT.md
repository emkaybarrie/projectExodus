# Reflex Rules Contract

Status: Canonical (FCL v2)
Last Updated: 2026-01-29
Scope: Defines automatic pattern detection and enforcement rules

---

## Purpose

Reflex Rules are the Forge's **automatic pattern detection system**. They watch for violations of contracts and invariants, and surface warnings with repair suggestions.

Think of Reflex Rules as the Forge's reflexes — automatic responses that don't require conscious thought but keep the system healthy.

---

## Design Principles

1. **Graduated Enforcement** — Rules can be soft (warn) or hard (block)
2. **Explainable** — Every warning explains what, why, and how to fix
3. **Repair-Oriented** — Rules suggest smallest viable repair
4. **Non-Punitive** — Rules help, they don't blame
5. **Observable** — All triggers and warnings are visible in Portal

---

## Enforcement Levels (FCL v2)

| Level | Behavior | Use Case |
|-------|----------|----------|
| **soft** | Warn but allow action to proceed | Advisory rules, low-risk violations |
| **hard** | Block action until resolved | Critical invariants, compliance gates |

### Enforcement Flow

```
Rule triggered →
  if enforcement === 'soft':
    Show warning → Allow action
  if enforcement === 'hard':
    Show error → Block action → Require resolution
```

### Hard Enforcement Rules (FCL v2)

These rules block actions when triggered:

| Rule ID | Blocks |
|---------|--------|
| RR-CC-MISSING | WO cannot be considered "complete" without CC |
| RR-SMOKE-FAIL | Production deploy blocked |
| RR-DISSONANCE-MISSING | Approval blocked without dissonance scan |
| RR-PHASE-SKIP | Phase transitions must be sequential |
| RR-GATE-BYPASS | Gate overrides require Director authority |

---

## Reflex Rule Schema (v1.0.0)

```json
{
  "ruleType": "ReflexRule",
  "schemaVersion": "1.0.0",
  "id": "RR-XXX",
  "name": "Human-readable rule name",
  "description": "What this rule detects",

  "trigger": {
    "condition": "machine-readable condition description",
    "source": "fsp | sentinel | wo_index | observations",
    "frequency": "on_heartbeat | on_load | continuous"
  },

  "violation": {
    "contract": "which contract is violated",
    "invariant": "which invariant is broken",
    "severity": "info | caution | warning | alert"
  },

  "warning": {
    "message": "human-readable warning message",
    "context": "additional context for understanding",
    "tone": "advisory framing (never accusatory)"
  },

  "repair": {
    "type": "wo_draft | manual_action | configuration",
    "suggestion": "smallest viable repair",
    "draft": {
      "title": "suggested WO title",
      "type": "repair | enhancement | investigation",
      "acceptance_criteria": ["list of criteria"]
    }
  },

  "enforcement": "soft | hard",
  "enabled": true
}
```

---

## Severity Levels

| Severity | Meaning | Portal Display |
|----------|---------|----------------|
| **info** | Informational, no action needed | Blue badge |
| **caution** | Worth noting, low priority | Purple badge |
| **warning** | Should be addressed | Amber badge |
| **alert** | Needs prompt attention | Red badge |

---

## Canonical Reflex Rules (v1)

### RR-CC-MISSING

**Continuation Contract Missing**

```json
{
  "id": "RR-CC-MISSING",
  "name": "Continuation Contract Missing",
  "description": "Detects executed Work Orders without Continuation Contracts",

  "trigger": {
    "condition": "WO.status === 'executed' && !WO.continuationContract",
    "source": "wo_index",
    "frequency": "on_heartbeat"
  },

  "violation": {
    "contract": "CONTINUATION_CONTRACT.md",
    "invariant": "Executed WOs must have Continuation Contracts",
    "severity": "warning"
  },

  "warning": {
    "message": "Work Order {woId} was executed but has no Continuation Contract",
    "context": "Continuation Contracts capture outcome, follow-ups, and learnings",
    "tone": "This WO may be missing important closure metadata"
  },

  "repair": {
    "type": "wo_draft",
    "suggestion": "Add Continuation Contract to the executed WO",
    "draft": {
      "title": "Add Continuation Contract to {woId}",
      "type": "repair",
      "acceptance_criteria": [
        "Continuation Contract added with outcome status",
        "Follow-up items documented (if any)",
        "Learnings captured (if any)"
      ]
    }
  },

  "enforcement": "soft",
  "enabled": true
}
```

---

### RR-WO-STUCK

**Work Order Stuck**

```json
{
  "id": "RR-WO-STUCK",
  "name": "Work Order Stuck",
  "description": "Detects Work Orders unchanged for extended period",

  "trigger": {
    "condition": "WO.daysSinceUpdate > 7 && WO.status !== 'executed'",
    "source": "wo_index",
    "frequency": "on_heartbeat"
  },

  "violation": {
    "contract": "WORK_ORDER_LIFECYCLE_CONTRACT.md",
    "invariant": "WOs should progress through lifecycle",
    "severity": "caution"
  },

  "warning": {
    "message": "Work Order {woId} has not progressed in {days} days",
    "context": "Stuck WOs may indicate blockers or abandoned work",
    "tone": "Consider reviewing this WO for blockers or closure"
  },

  "repair": {
    "type": "manual_action",
    "suggestion": "Review WO and either unblock, update status, or close with CC",
    "draft": null
  },

  "enforcement": "soft",
  "enabled": true
}
```

---

### RR-SMOKE-FAIL

**Smoke Tests Failing**

```json
{
  "id": "RR-SMOKE-FAIL",
  "name": "Smoke Tests Failing",
  "description": "Detects when production smoke tests are not passing",

  "trigger": {
    "condition": "observations.smokePass === false",
    "source": "observations",
    "frequency": "on_heartbeat"
  },

  "violation": {
    "contract": "DEPLOYMENT_CONTRACT.md",
    "invariant": "Production should pass smoke tests",
    "severity": "alert"
  },

  "warning": {
    "message": "Production smoke tests are not passing",
    "context": "This may indicate a deployment issue or service degradation",
    "tone": "Production health may be at risk"
  },

  "repair": {
    "type": "wo_draft",
    "suggestion": "Investigate and fix smoke test failures",
    "draft": {
      "title": "Investigate Production Smoke Test Failures",
      "type": "repair",
      "acceptance_criteria": [
        "Root cause identified",
        "Fix deployed or rollback executed",
        "Smoke tests passing"
      ]
    }
  },

  "enforcement": "soft",
  "enabled": true
}
```

---

### RR-FSP-STALE

**Forge State Pack Stale**

```json
{
  "id": "RR-FSP-STALE",
  "name": "Forge State Pack Stale",
  "description": "Detects when FSP has not been refreshed recently",

  "trigger": {
    "condition": "fsp.generatedAt > 48 hours ago",
    "source": "fsp",
    "frequency": "on_load"
  },

  "violation": {
    "contract": "FORGE_STATE_PACK_CONTRACT.md",
    "invariant": "FSP should reflect current state",
    "severity": "info"
  },

  "warning": {
    "message": "Forge State Pack was generated {hours} hours ago",
    "context": "Stale FSP may not reflect recent changes",
    "tone": "Consider refreshing FSP for accurate state"
  },

  "repair": {
    "type": "manual_action",
    "suggestion": "Run generate-fsp.mjs to refresh",
    "draft": null
  },

  "enforcement": "soft",
  "enabled": true
}
```

---

### RR-RISK-UNMITIGATED

**High-Severity Risk Unmitigated**

```json
{
  "id": "RR-RISK-UNMITIGATED",
  "name": "High-Severity Risk Unmitigated",
  "description": "Detects critical or high risks without mitigation",

  "trigger": {
    "condition": "risk.severity in ['critical', 'high'] && risk.status in ['detected', 'acknowledged']",
    "source": "fsp",
    "frequency": "on_heartbeat"
  },

  "violation": {
    "contract": "FORGE_STATE_PACK_CONTRACT.md",
    "invariant": "High-severity risks should have mitigation plans",
    "severity": "warning"
  },

  "warning": {
    "message": "Risk '{riskId}' is {severity} but not yet mitigated",
    "context": "High-severity risks may impact system stability",
    "tone": "Consider creating a mitigation plan"
  },

  "repair": {
    "type": "wo_draft",
    "suggestion": "Create mitigation plan for high-severity risk",
    "draft": {
      "title": "Mitigate Risk: {riskDescription}",
      "type": "repair",
      "acceptance_criteria": [
        "Root cause analyzed",
        "Mitigation implemented or compensating controls in place",
        "Risk status updated to mitigated"
      ]
    }
  },

  "enforcement": "soft",
  "enabled": true
}
```

---

### RR-DISSONANCE-MISSING (FCL v2)

**Dissonance Scan Missing**

```json
{
  "id": "RR-DISSONANCE-MISSING",
  "name": "Dissonance Scan Missing",
  "description": "Detects WOs pending approval without dissonance scan",

  "trigger": {
    "condition": "WO.status === 'pending-approval' && !WO.gateChecks?.dissonanceScan?.completed",
    "source": "wo_index",
    "frequency": "on_heartbeat"
  },

  "violation": {
    "contract": "WORK_ORDER_LIFECYCLE_CONTRACT.md",
    "invariant": "Dissonance scan required before approval",
    "severity": "warning"
  },

  "warning": {
    "message": "Work Order {woId} awaits approval but has no dissonance scan",
    "context": "Dissonance scans detect conflicts with existing work",
    "tone": "Complete dissonance scan before approving this WO"
  },

  "repair": {
    "type": "manual_action",
    "suggestion": "Run dissonance scan for this WO",
    "draft": null
  },

  "enforcement": "hard",
  "enabled": true
}
```

---

### RR-PHASE-SKIP (FCL v2)

**Phase Skip Detected**

```json
{
  "id": "RR-PHASE-SKIP",
  "name": "Phase Skip Detected",
  "description": "Detects attempts to skip lifecycle phases",

  "trigger": {
    "condition": "transition.targetPhase !== transition.expectedNextPhase",
    "source": "gate_check",
    "frequency": "continuous"
  },

  "violation": {
    "contract": "WORK_ORDER_LIFECYCLE_CONTRACT.md",
    "invariant": "Phase transitions must be sequential",
    "severity": "alert"
  },

  "warning": {
    "message": "Cannot transition from {fromPhase} to {toPhase} — phase skip detected",
    "context": "Phases must progress sequentially to ensure process integrity",
    "tone": "Complete current phase before advancing"
  },

  "repair": {
    "type": "manual_action",
    "suggestion": "Complete current phase requirements first",
    "draft": null
  },

  "enforcement": "hard",
  "enabled": true
}
```

---

### RR-GATE-BYPASS (FCL v2)

**Gate Bypass Attempted**

```json
{
  "id": "RR-GATE-BYPASS",
  "name": "Gate Bypass Attempted",
  "description": "Detects attempts to bypass authority gates",

  "trigger": {
    "condition": "gate.check === false && !override.directorApproval",
    "source": "gate_check",
    "frequency": "continuous"
  },

  "violation": {
    "contract": "FORGE_KERNEL.md",
    "invariant": "Authority gates cannot be bypassed without Director override",
    "severity": "alert"
  },

  "warning": {
    "message": "Action blocked by gate: {gateName} — {gateReason}",
    "context": "Gates protect process integrity",
    "tone": "Request Director override if bypass is necessary"
  },

  "repair": {
    "type": "manual_action",
    "suggestion": "Resolve gate condition or request Director override",
    "draft": null
  },

  "enforcement": "hard",
  "enabled": true
}
```

---

## Warning Output Schema

When a Reflex Rule triggers, it produces a ReflexWarning:

```json
{
  "warningType": "ReflexWarning",
  "schemaVersion": "1.0.0",
  "id": "rw-{timestamp}-{random}",
  "generatedAt": "ISO8601",

  "rule": {
    "id": "RR-XXX",
    "name": "Rule name"
  },

  "trigger": {
    "what": "what was detected",
    "where": "which entity/WO/etc",
    "when": "when detected"
  },

  "violation": {
    "contract": "which contract",
    "invariant": "which invariant",
    "severity": "warning level"
  },

  "message": "human-readable warning",
  "context": "additional context",
  "tone": "advisory framing",

  "repair": {
    "suggestion": "what to do",
    "draft": { ... } | null
  }
}
```

---

## Evaluation Process

1. **On Heartbeat** — Rules with `frequency: on_heartbeat` are evaluated
2. **On Load** — Rules with `frequency: on_load` are evaluated at Portal load
3. **Continuous** — (Future) Rules evaluated on every state change

### Evaluation Algorithm

```
for each enabled rule:
  if rule.trigger.condition evaluates to true:
    generate ReflexWarning
    add to state.reflexWarnings
    if rule.repair.type === 'wo_draft':
      add to state.repairDrafts
    if rule.enforcement === 'hard':
      return { blocked: true, reason: warning.message }
```

### Hard Enforcement (FCL v2)

When a rule with `enforcement: 'hard'` triggers during an action:

1. Warning is generated and recorded
2. Action is **blocked** (not just warned)
3. Gate records `gate_blocked` event in Chronicler
4. User must resolve condition before retrying

---

## Portal Integration

### Reflex Panel

New panel in Forge tab showing:
- Active warnings count
- List of warnings (grouped by severity)
- Repair suggestions with "Copy Draft" action

### WO Card Badges

- **CC Present:** ✓ badge
- **CC Missing:** ⚠ "Missing CC" badge
- **Stuck:** ⏳ "Stuck" badge

### Warning Toast (Future)

Pop-up notification when new warnings detected.

---

## What Reflex Rules Do NOT Do

1. **Do NOT auto-create WOs** — Draft suggestions only
2. **Do NOT modify state** — Read-only evaluation
3. **Do NOT punish** — Advisory tone, never accusatory

### FCL v2 Note: Blocking Behavior

In FCL v2, rules with `enforcement: 'hard'` **do block** execution. This is intentional — hard rules protect critical invariants. Soft rules remain advisory only.

---

## Cross-References

- [CONTINUATION_CONTRACT.md](./CONTINUATION_CONTRACT.md) — CC enforcement
- [SENTINEL_CONTRACT.md](./SENTINEL_CONTRACT.md) — Health monitoring
- [FORGE_STATE_PACK_CONTRACT.md](./FORGE_STATE_PACK_CONTRACT.md) — State source

---

End of Contract.
