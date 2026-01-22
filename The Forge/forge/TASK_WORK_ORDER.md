📋 TASK_WORK_ORDER.md

Status: Canonical Template
Audience: All agents and Director
Purpose: Formalise every task within the Forge into a standard work order
Behaviour: If underspecified, agents must return a partially filled version with explicit requests for missing fields (B-mode tolerance)

1. Usage Protocol

No work begins without a completed Work Order.

Any agent receiving an informal instruction must translate it into this template.

If fields are missing, the agent returns a partially filled Work Order with clear placeholders and questions.

Only when all fields are complete may execution start.

2. Work Order Fields
Section	Description	Example
Task ID	Unique identifier or descriptive slug (e.g., FO-23-quest-ui-sync)	Auto-assigned or manual
Task Type	uplift, refactor, audit, spec-sync, design, research, meta	spec-sync
Intent Statement	Single sentence describing why this task exists	“Align Quest UI spec with latest Vitals layout.”
Scope of Work	Exactly what is to change or be produced	“Review and update Quest spec; no code modification.”
Allowed Files / Artifacts	Explicit list of files that may be read or modified	/specs/journeys/quest.md
References	Linked specs, lessons, or prior tasks that inform this one	FORGE_LESSONS.md §2.1
Success Criteria	Observable conditions for completion	“Spec and UI match; no scope creep.”
Forbidden Changes	Things explicitly out of scope	“No new components or animation logic.”
Assumptions & Dependencies	Known prerequisites or context	“Forge Capsule v1.0 is current.”
Expected Outputs	Deliverables (text, code, design, doc)	“Updated spec file + summary comment.”
Agent Ownership	Which agent executes / reviews / approves	Executor = Claude; Architect = ChatGPT; Director = Emkay
Review & Reflection Notes	Space for post-task evaluation	“To be filled after completion.”
3. Handling Incomplete Orders (Mode B Tolerance)

When fields are missing or vague:

Agent generates a partially filled form showing:

[MISSING] markers next to empty fields

brief questions for clarification

Agent returns this to the Director or originator.

No execution occurs until all [MISSING] fields are resolved.

The finalised form is stored alongside outputs for traceability.

4. Work Order Validation Checklist

Before execution, agents must verify:

 All mandatory fields complete

 Scope and forbidden changes are mutually exclusive

 Success criteria are observable and testable

 Referenced specs exist and are current

 Dependencies are available or explicitly noted

 No violation of Forge Kernel or Invariants

Only when all boxes are checked may execution begin.

5. Post-Task Reflection

After completion:

Fill “Review & Reflection Notes” with:

What worked well

What friction appeared

Any candidate lesson for FORGE_LESSONS.md

If a lesson is identified, it must be recorded within 24 hours.

6. Template Example (Simplified)
TASK ID: FO-01-Forge-Capsule
TASK TYPE: spec-sync
INTENT: Create a portable Forge Capsule for cross-agent use.
SCOPE: Draft and finalise FORGE_CAPSULE.md v1.0
ALLOWED FILES: /docs/forge_capsule.md
REFERENCES: FORGE_KERNEL.md, FORGE_STATE.md
SUCCESS CRITERIA: Capsule exists and agents can reason from it.
FORBIDDEN CHANGES: None
ASSUMPTIONS: Dual-Track Mode active
EXPECTED OUTPUTS: Finalised Capsule
AGENT OWNERSHIP: Architect (ChatGPT)
REVIEW NOTES: —


End of Work Order Template