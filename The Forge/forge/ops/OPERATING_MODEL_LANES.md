# Operating Model Lanes

Status: Canonical
Audience: All agents
Scope: Defines parallel development lanes and canonical truth precedence

---

## Purpose

This document defines how Forante, Forge, MyFi, and other entities progress in parallel without blocking each other or drifting out of alignment.

---

## 1. Development Lanes

Work in the Forante network proceeds across parallel lanes. Each lane has distinct responsibilities and may progress independently within its scope.

### Lane A: Forante Governance
**Owner:** Forante (Constitutional Layer)
**Scope:**
- Constitutional documents (Forante Kernel, Entity Charters)
- Network-wide policies
- Entity registration and tier assignment
- Cross-entity standards

**Artifacts:**
- `Forante/FORANTE_KERNEL.md`
- `Forante/FORANTE_INDEX.md`
- Entity charters

### Lane B: Forge Institution
**Owner:** Forge
**Scope:**
- SDLC process and methodology
- Work Order lifecycle
- Agent onboarding and governance
- Portal infrastructure
- Share Pack governance

**Artifacts:**
- `The Forge/forge/FORGE_KERNEL.md`
- `The Forge/forge/FORGE_STATE.md`
- `The Forge/forge/ops/*`
- `The Forge/forge/portal/*`
- `The Forge/forge/exports/*`

### Lane C: MyFi Flagship Entity
**Owner:** MyFi (as Entity)
**Scope:**
- MyFi product development
- MyFi-specific surfaces, parts, journeys
- MyFi product state and specs
- MyFi-specific documentation

**Artifacts:**
- `Project MyFi/ProjectMyFi_vLatest/*`
- MyFi specs and contracts

### Lane D: Other Forge-Created Entities
**Owner:** Individual Entities
**Scope:**
- Entity-specific product development
- Entity-specific artifacts
- Entity charters (governed by Forante)

**Artifacts:**
- Entity-specific directories (future)

---

## 2. Lane Independence Rules

### Parallel Progress
- Lanes may progress independently within their scope
- Work in one lane does not block work in another lane
- Cross-lane dependencies must be explicit and documented

### Lane Boundaries
- Entities do not modify Forge artifacts directly
- Forge does not modify Forante constitutional documents directly
- All cross-lane changes flow through Work Orders with appropriate approval

### Conflict Resolution
- If lanes conflict, escalate to the higher governance layer
- Forante > Forge > Entity (authority hierarchy)

---

## 3. Canonical Truth Precedence

When resolving ambiguity or conflict, truth flows from higher to lower:

```
1. Share Pack (Constitutional Law)
       ↓
2. Forante Kernel (Governance Foundation)
       ↓
3. Forge Kernel (Operational Law)
       ↓
4. Forge State (Current Reality)
       ↓
5. Entity Docs (Applied/Local Law)
       ↓
6. Code Reality (Implementation)
       ↓
7. Agent Inference (Last Resort)
```

### Precedence Rules

**Share Pack = Constitutional Law**
- The Share Pack represents the canonical, portable truth
- If repo docs conflict with Share Pack, Share Pack wins
- Conflicts are resolved by updating the Share Pack, not ignoring it

**Repo Docs = Applied Law**
- Repo documents implement and apply Share Pack law
- They may add detail but not contradict Share Pack
- Local exceptions must be explicitly documented

**Code = Implementation**
- Code should reflect docs; if it doesn't, docs win
- Code reality is observed but not authoritative
- Drift between code and docs triggers remediation

---

## 4. Entity-Triggered Forge Evolution

MyFi (and other entities) may trigger Forge evolution, but only through formal mechanisms.

### Valid Evolution Path
```
Entity Pain Point
    ↓
Observation documented
    ↓
Work Order proposed (type: Forge Evolution)
    ↓
Forge review and approval
    ↓
Forge Kernel/Process updated
    ↓
Share Pack updated
    ↓
Entities benefit downstream
```

### Invalid Evolution Patterns
- Entity unilaterally modifies Forge docs
- Entity implements Forge-level changes in entity code
- Agent makes ad-hoc process changes without Work Order
- Pain point addressed by local workaround instead of Forge improvement

### Example: MyFi Triggers Forge Improvement
1. MyFi team encounters friction with Work Order format
2. Observation: "Current WO template lacks field X which MyFi needs"
3. Work Order: `FO-Forge-Evolve-WO-Template-Add-FieldX`
4. Forge reviews: Is this genuinely needed? Does it benefit all entities?
5. If approved: Forge Kernel and templates updated
6. Share Pack refreshed
7. All entities (including MyFi) benefit from improved template

---

## 5. AI Agent Governance

### Agent Authority
- AI agents may **propose** Work Orders
- AI agents may **execute** approved Work Orders
- AI agents may **not** execute without explicit approval
- AI agents may **not** modify governance documents unilaterally

### Agent Lane Awareness
Agents must be aware of which lane they're operating in:
- Forante Governance work requires constitutional approval
- Forge Institution work requires Forge-level approval
- Entity work requires entity-level approval

### Agent Conflict Handling
When an agent detects cross-lane conflict:
1. Pause execution
2. Document the conflict
3. Propose resolution as new Work Order
4. Wait for approval before proceeding

---

## 6. Cross-References

- [Forante Kernel](../../../Forante/FORANTE_KERNEL.md) — Constitutional foundation
- [Forante Index](../../../Forante/FORANTE_INDEX.md) — Governance navigation
- [Forge Kernel](../FORGE_KERNEL.md) — Operational law
- [Forge Index](../FORGE_INDEX.md) — Forge navigation
- [Executor Playbook](./EXECUTOR_PLAYBOOK.md) — AI execution protocol

---

End of Operating Model Lanes.
