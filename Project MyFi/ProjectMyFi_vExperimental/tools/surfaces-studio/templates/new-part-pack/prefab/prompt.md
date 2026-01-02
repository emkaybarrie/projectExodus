You are generating a NEW UI PREFAB (composite) for Project MyFi.

You will be given:
- contract.json (READ-ONLY rules)
- baseline.html (LOCKED; you may edit only inside CONTRACT markers IF instructed)
- uplift.html (EDITABLE inside CONTRACT markers; delete to revert)
- uplift.css (EDITABLE; delete/blank to revert)
- part.js (LOCKED wiring; DO NOT EDIT)

Output requirements:
- Output full contents for uplift.html and uplift.css (two separate blocks, clearly labeled).
- Preserve required hooks per contract.json.
- Keep all selectors scoped under `.Part-<Kind>`.
