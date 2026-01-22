📘 FORGE_LESSONS.md

Status: Canonical · Living Memory
Audience: All agents and Director
Purpose: Capture learning, corrections, and refinements to both product and process
Tone: Narrative-first, structurally anchored

How to Use This File

This file exists to turn experience into institutional memory.

Entries may be written by:

the Director (human)

any AI agent

collaboratively

Narrative expression is encouraged.
Structure ensures agents can reason over it.

If a lesson matters, it belongs here.

Lesson Entry Structure (Hybrid)

Each lesson must contain the following sections.
Narrative may flow freely inside them.

Lesson ID

Short, stable identifier

Format: L-YYYY-MM-DD-<slug>

Context (Narrative)

Describe what was happening.

What were we trying to do?

What prompted the situation?

What assumptions were in play?

This section is written for humans first.

Observation

What actually happened?

Friction

Surprise

Failure

Unexpected success

Emotional signal (“this felt wrong/right”)

Be honest. Precision is more important than polish.

Insight

What did we learn?

About the product

About the process

About agent behaviour

About the Director’s thinking patterns

This is the meaning-making step.

Rule or Heuristic (If Any)

Does this lesson introduce or modify:

a hard rule?

a soft guideline?

a warning signal?

a preferred pattern?

If yes, state it clearly.
If no, explicitly say “No new rule”.

Agents rely on this clarity.

Scope

Where does this lesson apply?

Global (entire Forge)

Process

Product

UI

Journeys

Agent Interaction

Director Workflow

Multiple scopes allowed.

Impacted Artifacts

List any artifacts this lesson should influence:

FORGE_KERNEL.md

FORGE_STATE.md

TASK_WORK_ORDER.md

Specs

Code

None (observation-only)

If changes are required, they must be scheduled as Work Orders.

Status

One of:

Observed

Active

Canonised

Deprecated

Only Canonised lessons are treated as binding.

Seed Lessons (Initial)

These seed entries activate the learning loop.

Lesson ID

L-2026-01-Forge-Process-First

Context
During early discussions, there was a temptation to continue building MyFi directly while “figuring out the process later”.

Observation
Every time process was deferred, complexity increased and earlier decisions had to be re-litigated.

Insight
Institutional structure reduces cognitive load over time, even if it feels slower initially.

Rule or Heuristic
If the Forge process is unclear, pause product work and fix the process first.

Scope
Global · Process · Product

Impacted Artifacts
FORGE_KERNEL.md
FORGE_STATE.md

Status
Canonised

Lesson ID

L-2026-01-Narrative-Director-Strength

Context
The Director naturally reasons in narrative, metaphor, and intuition rather than rigid schemas.

Observation
Forcing purely rigid structure caused friction and disengagement, while unstructured narrative caused ambiguity for agents.

Insight
The optimal interface is narrative-first expression constrained by lightweight structure.

Rule or Heuristic
Allow narrative expression, but always anchor it to explicit sections agents can parse.

Scope
Process · Agent Interaction · Director Workflow

Impacted Artifacts
FORGE_LESSONS.md
TASK_WORK_ORDER.md

Status
Canonised

Lesson ID

L-2026-01-Model-Independence

Context
Forge design considered scenarios where repo-aware agents (e.g. Claude) were unavailable.

Observation
Process designs that assumed specific model capabilities became brittle.

Insight
The Forge must be model-agnostic; capability differences are handled through artifacts, not assumptions.

Rule or Heuristic
Never require a specific AI capability for institutional correctness.

Scope
Global · Agent Interaction · Process

Impacted Artifacts
FORGE_CAPSULE.md
FORGE_KERNEL.md

Status
Canonised

Maintenance Rules

Lessons are never deleted; they may be deprecated.

Contradictory lessons must be reconciled explicitly.

Agents must cite relevant lessons when guiding or refusing work.

A lesson without scope or status is incomplete.

End of Forge Lessons