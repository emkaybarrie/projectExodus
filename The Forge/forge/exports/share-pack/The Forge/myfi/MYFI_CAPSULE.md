# MyFi Capsule (Portable Product Context)

**Status:** Portable · Canonical within product domain  
**Audience:** Director + all agents  
**Purpose:** Provide enough product truth for any agent to reason safely without repo access.

## 1) What MyFi is
MyFi is a gamified behavioural finance system. Real-world spending and budgeting are mapped into RPG-like energy resources and progression.

Core resources:
- Health — survival / emergency buffer
- Mana — intentional power spending
- Stamina — day-to-day flexible spending
- Essence — long-term savings/investment potential (ethical, ring-fenced)

The system incentivises fast, low-friction tagging and reflection.

## 2) What is architecturally true right now
- Mobile-first runtime, no build step (pure ESM)
- Screen system oriented around Surfaces · Slots · Parts
- Hub/Vitals screen is the canonical anchor
- Quests is intended as the reference screen for repeatable AI-safe UI workflows

## 3) What is stable vs in flux
Stable:
- Vitals philosophy and semantics
- Hub-centric UX
- Dual-currency ethics framing

In flux:
- exact UI DSL and screen composition APIs
- quest implementation details
- automation/CI hooks

## 4) How to safely “continue MyFi work”
- Start with /myfi/PRODUCT_STATE.md
- Use Forge Work Orders for any task
- Prefer spec-first updates
- Avoid large refactors without repo-aware validation

## 5) Current intent
Build a repeatable, AI-safe production line while incrementally progressing MyFi toward demo/pilot readiness.
