<!-- ---FILE: PROMPT_RULES.md -->
# MyFi Forge — Prompt Rules (Static)

Non-negotiables for AI-generated packs:
- Output MUST be full file replacements only (no surgical edits).
- No new external dependencies.
- No architecture drift (VM → Surfaces → Parts → Journeys remains).
- Deterministic runtime: any missing resource must render a visible error card.
- Contracts are the firewall:
  - required hooks must exist
  - actions must be allowlisted

## Paste-back output format (MANDATORY)
- The assistant MUST output **one file per snippet** (one code block per file).
- Each snippet MUST begin with a single header line:
  ---FILE: <path>
- The remainder of the snippet MUST be the complete file content.
- No multi-file snippets.
- No additional commentary inside snippets (commentary can be outside code blocks).

Example:

```text
---FILE: src/parts/EmptyCard/part.js
<complete file content here>
