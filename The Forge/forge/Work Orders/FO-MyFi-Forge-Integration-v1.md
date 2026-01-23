✅ Work Order (finalised)

TASK ID: FO-MyFi-Forge-Integration-v1
TASK TYPE: design · spec-sync (repo wiring plan + canonical artifacts)
INTENT: Integrate Forge files into the codebase and formally onboard MyFi into the Forge so the system converges toward “everything known at this point,” validated by the Director.
SCOPE OF WORK:

Define canonical folder layout (/forge/ + /myfi/)

Provide paste-ready onboarding artifacts that make MyFi “registered” and keep it continuously synchronisable

Define the Director validation checkpoint to “seal” the onboarding snapshot
ALLOWED FILES / ARTIFACTS:

New files under /forge/ and /myfi/

(Optional) Root README.md update for pointers (not required to proceed)
REFERENCES: FORGE_KERNEL.md, FORGE_STATE.md, FORGE_CAPSULE.md, FORGE_LESSONS.md, FORGE_EVOLUTION.md, FORGE_ROADMAP.md, PRODUCT_STATE.md
SUCCESS CRITERIA:

Repo contains /forge/ with canonical Forge artifacts and an index/manifest.

Repo contains /myfi/ with a “product onboarding pack” (capsule + glossary + architecture map + status matrix + validation checklist).

A Director validation step exists that produces a “sealed snapshot” marker.

The next step is self-signposted toward automation (sync cadence + repo-aware agent onboarding).
FORBIDDEN CHANGES:

No refactors of runtime or UI system

No new MyFi features yet
ASSUMPTIONS & DEPENDENCIES:

We can proceed without Claude

You will paste files into the repo (or generate them via your own tooling)
EXPECTED OUTPUTS:

Folder layout spec

Paste-ready files (full content)

Next-step signpost
AGENT OWNERSHIP: Architect (me) drafts; Director (you) validates and seals; Executor (Claude) later reconciles with repo reality.