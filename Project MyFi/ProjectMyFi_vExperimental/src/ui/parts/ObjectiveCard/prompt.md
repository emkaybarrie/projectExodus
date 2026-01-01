# ObjectiveCard AI Uplift Pack (v1)

You are editing a MyFi UI part. Do **not** change application architecture, routing, or JS wiring.

## Files you may edit
### 1) `uplift.css`
- Visual-only tweaks for ObjectiveCard.
- Deleting/clearing this file should revert visuals to baseline.

### 2) `uplift.html`
- Optional markup uplift.
- You may edit ONLY inside the `CONTRACT:BEGIN/END` block.
- Deleting this file should revert markup to `baseline.html`.

## Do not edit
- `baseline.html` (locked baseline markup)
- `part.js` (wiring + safeguards)
- `contract.json` (hook map + rules)

## Hard rules
1) **CSS scope:** Every selector in `uplift.css` must start with `.ObjectiveCard`.
2) **Do not rename hooks:** Do not remove or rename elements with `data-hook="..."` attributes.
3) **Keep actions:** Buttons must keep `data-act="focus"` and `data-act="claim"`.
4) **Do not touch global layout:** Never style `body`, `html`, `#plane`, or `.screen-root`.
5) **Output only the file contents** for the file you are editing.

## Available hooks (from contract.json)
- `row`, `meta`, `type`, `title`, `actions`, `btnFocus`, `btnClaim`,
  `narrative`, `bar`, `fill`, `foot`, `progressText`, `reward`

## Suggested approach
- Prefer local token overrides on `.ObjectiveCard` (CSS variables) for cohesive theming.
- Use subtle contrasts for readability (title > narrative > progress > reward/actions).
- If adding new visual elements, keep them inside the contract block and add new `data-hook` names.
