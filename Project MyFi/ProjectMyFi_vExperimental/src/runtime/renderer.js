import { loadContractForPart, wrapCtxWithContract, validatePlacementAgainstContract } from "./contractValidator.js";

export function createRenderer({ registry, loader }) {
  let mounted = null;

  function findSlots(rootEl) {
    const nodes = rootEl.querySelectorAll("[data-slot]");
    const slots = {};
    nodes.forEach(n => { slots[n.getAttribute("data-slot")] = n; });
    return slots;
  }

  async function mountScreen({ root, screenDir, ctx }) {
    // clear previous
    if (mounted?.destroy) mounted.destroy();
    root.innerHTML = "";

    // load surface + layout
    const { surface } = await loader.loadSurface(screenDir);
    const layout = await loader.loadLayout(screenDir, surface);

    // build screen root
    const screenEl = document.createElement("div");
    screenEl.className = "myfiScreen";
    screenEl.innerHTML = layout.html;

    // attach layout CSS
    const styleEl = document.createElement("style");
    styleEl.textContent = layout.css;
    document.head.appendChild(styleEl);

    root.appendChild(screenEl);

    // mount parts into slots
    const slots = findSlots(screenEl);
    const partInstances = [];

    for (const [slotId, placements] of Object.entries(surface.slots || {})) {
      const slotEl = slots[slotId];
      if (!slotEl) throw new Error(`Missing slot in layout: ${slotId}`);

      for (const p of placements) {
        const Part = registry.get(p.part);
        const mountEl = document.createElement("div");
        mountEl.setAttribute("data-part", p.part);
        slotEl.appendChild(mountEl);

        // Load part contract and wrap ctx (dev guardrails)
        const contract = await loadContractForPart(p.part);
        const bind = p.bind || {};

        // Validate surface placement against contract (dev-only warnings)
        const placementErrors = validatePlacementAgainstContract({
          partId: p.part,
          contract,
          bind,
          screenDir
        });
        if (placementErrors.length) {
          placementErrors.forEach((msg) => console.warn(msg));
        }

        const guardedCtx = wrapCtxWithContract({
          ctx,
          partId: p.part,
          contract,
          bind
        });

        const maybeInst = Part.mount({
          el: mountEl,
          bind,
          ctx: guardedCtx,
          contract // optional extra access if you want it
        });

        const inst = (maybeInst && typeof maybeInst.then === "function")
          ? await maybeInst
          : maybeInst;

        if (inst?.destroy) partInstances.push(inst);
      }
    }

    mounted = {
      destroy() {
        partInstances.forEach(i => i.destroy());
        styleEl.remove();
        root.innerHTML = "";
      }
    };
  }

  return { mountScreen };
}
