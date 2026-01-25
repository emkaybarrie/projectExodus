# Forante Kernel

Status: Canonical
Audience: All agents (human and AI)
Scope: Constitutional layer governing Forante, Forge, and all Forge-created entities

---

## Canonical Model Declaration

**Model 3: Forge as Institutional OS, MyFi as Flagship Entity**

This document establishes the constitutional foundation of the Forante network:
- Forante owns and evolves the Forge
- Forge is an institutional, AI-native SDLC operating system embodying Forante's baseline way of building
- Forge produces Forge-native entities that inherit this operating baseline
- MyFi is the flagship entity produced by Forge and serves as the proving ground for Forge evolution
- External entities may use Forge independently or integrate more deeply into the Forante/MyFi ecosystem

---

## 1. What Forante Is

Forante is the **steward company** — the constitutional layer that:
- Owns the Forge as its institutional operating system
- Sets the baseline principles for how entities are built
- Governs the network of Forge-created entities
- Maintains the shared infrastructure and services layer

Forante is not a product company. It is an **institutional holding** that enables entities to build products using a shared, disciplined methodology.

---

## 2. Core Definitions

### 2.1 Forante
The steward company and constitutional layer. Owns and evolves the Forge. Does not build products directly but enables entities that do.

### 2.2 Forge
The institutional, AI-native SDLC operating system. Embodies Forante's baseline methodology for building software. Produces entities, governs them, and provides shared infrastructure.

### 2.3 Entity
A Forge-created or Forge-integrated organisation or project. Each entity:
- Has a defined charter
- Follows Forge process
- May build one or more products
- Operates at a defined integration tier

### 2.4 Product
A deliverable created by an entity. Products are outputs; entities are actors. Example: MyFi (entity) produces the MyFi app (product).

### 2.5 Portal
A governance interface. The Forge Portal is the primary governance UI. Entities may have derived portals for their specific needs.

### 2.6 Share Pack
The constitutional truth export. A portable snapshot of Forge and entity state that non-repo-aware agents can consume. Share Pack is constitutional law; repo docs are applied law.

### 2.7 Work Order
The atomic unit of work in the Forge. All meaningful changes flow through Work Orders. They capture intent, scope, constraints, and acceptance criteria.

---

## 3. Entity Integration Tiers

Entities integrate with the Forante network at one of three tiers:

### Tier 0: Forge-Native, Independent Service User
- Uses Forge methodology and tooling
- Operates independently with no shared network services
- Self-contained governance and infrastructure
- Example: An external team adopting Forge process

### Tier 1: Forge-Native with Shared Network Services
- Uses Forge methodology and tooling
- Accesses shared Forante network services (auth, data, infrastructure)
- Maintains independent product identity
- Participates in network governance

### Tier 2: Integrated into MyFi Ecosystem
- Deeply integrated with MyFi as the flagship platform
- May share data, users, or features with MyFi
- Product boundaries may be porous
- Highest level of Forante network participation

---

## 4. MyFi as Flagship Entity

**MyFi is the flagship proving ground for Forge evolution.**

This means:
- MyFi is the first and primary entity built by Forge
- Forge improvements often originate from MyFi pain points
- MyFi demonstrates what Forge-native development looks like at scale
- MyFi's success is tied to Forge's success, but Forge's integrity comes first

The relationship is **symbiotic but asymmetric**:
- If Forge and MyFi conflict, Forge integrity takes precedence
- MyFi product pain may trigger proposed Forge evolution via Work Orders
- MyFi does not govern Forge; Forante governs Forge

---

## 5. Governance Hierarchy

```
Forante (Constitutional Layer)
    └── Forge (Institutional OS)
            ├── Forge Portal (Governance UI)
            ├── Share Pack (Truth Export)
            └── Entities
                    ├── MyFi (Flagship, Tier 2)
                    ├── [Future Entity] (Tier 1)
                    └── [Future Entity] (Tier 0)
```

Authority flows downward. Entities do not modify Forge; they propose changes via Work Orders that Forante approves.

---

## 6. Constitutional Principles

### 6.1 Institutional Integrity First
Forge process and methodology take precedence over product velocity. Short-term gains that compromise institutional integrity are forbidden.

### 6.2 Explicit Over Implicit
All decisions, rules, and changes must be explicit and traceable. Silent drift, ad-hoc exceptions, and undocumented practices violate the Forge.

### 6.3 Proposal Over Unilateral Action
Agents and entities propose changes; they do not enact them unilaterally. Approval flows through defined governance mechanisms.

### 6.4 Share Pack as Constitutional Law
The Share Pack represents the canonical truth. Repo documents are applied law that must align with the Share Pack. Conflicts are resolved by updating the Share Pack, not by ignoring it.

---

## 7. Forge Constitutional Protections

Forge OS (the institutional operating system) is protected by constitutional safeguards that prevent gradual erosion of its guarantees.

**Non-Regression Principle:**
Any change to Forge that weakens authority separation, verification gates, provenance requirements, constitutional binding, or observability is considered a regression. Regressions are invalid unless explicitly approved by the Director with stated rationale, compensating controls, and rollback plan.

This ensures the Forge cannot be hollowed out through incremental "small edits" or convenience changes. Entities (including MyFi) inherit these protections and cannot circumvent them.

See: [Forge Kernel Section 9A](../The%20Forge/forge/FORGE_KERNEL.md) for the full Non-Regression Principle.

---

## 8. Cross-References

- [Forge Kernel](../The%20Forge/forge/FORGE_KERNEL.md) — Operational law for the Forge
- [Forge Index](../The%20Forge/forge/FORGE_INDEX.md) — Navigation to Forge artifacts
- [MyFi Master Reference](../Project%20MyFi/ProjectMyFi_vLatest/MYFI_MASTER_REFERENCE.md) — MyFi entity documentation
- [Operating Model Lanes](../The%20Forge/forge/ops/OPERATING_MODEL_LANES.md) — Parallel development governance

---

End of Forante Kernel.
