# SegmentTabs uplift prompt

You are editing **ONLY** the file: `src/ui/primitives/SegmentTabs/uplift.css`.

Rules:
- Output the **full updated CSS file only**.
- Do **not** suggest changes to JS/HTML.
- Scope **every selector** under `.SegmentTabsRoot`.
- Do not target global selectors (`body`, `html`, `.screen-root`, `#plane`).
- Do not rename or rely on classes not listed in `contract.json`.

Available hooks (from contract):
- Root: `.SegmentTabsRoot`
- Buttons: `button[data-tab]` (the buttons also have class `qbTab`)
- Active state class: `.is-active`

Goal:
- Improve spacing, readability, and "segmented" feel while staying consistent with baseline tokens/base.