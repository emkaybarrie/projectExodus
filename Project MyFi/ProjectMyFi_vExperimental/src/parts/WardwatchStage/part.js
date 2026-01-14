// ---FILE: src/parts/WardwatchStage/part.js
import { ensureCssLink, fetchText, mapHooks } from "../../runtime/assetLoader.js";

const WardwatchStage = {
  async mount({ el, ctx }) {
    // 1) Load uplift CSS (no build step)
    await ensureCssLink("./src/parts/WardwatchStage/uplift.css", "css-part-WardwatchStage");

    // 2) Load baseline HTML
    const html = await fetchText("./src/parts/WardwatchStage/baseline.html");
    el.innerHTML = html;

    const hooks = mapHooks(el);

    // Tabs (World / Events / Loadout)
    const tabs = [
      { btn: hooks.tabWorld, page: hooks.pageWorld, id: "world" },
      { btn: hooks.tabEvents, page: hooks.pageEvents, id: "events" },
      { btn: hooks.tabLoadout, page: hooks.pageLoadout, id: "loadout" },
    ];

    function setActiveTab(id) {
      for (const t of tabs) {
        const active = t.id === id;
        t.btn?.classList.toggle("isActive", active);
        t.page?.classList.toggle("isActive", active);
      }
    }

    hooks.tabWorld?.addEventListener("click", () => setActiveTab("world"));
    hooks.tabEvents?.addEventListener("click", () => setActiveTab("events"));
    hooks.tabLoadout?.addEventListener("click", () => setActiveTab("loadout"));

    // CTA + exit
    hooks.btnAid?.addEventListener("click", () => ctx.actions?.hub?.enterBattle?.());
    hooks.btnExitBattle?.addEventListener("click", () => ctx.actions?.hub?.exitBattle?.());

    // Battle skills (Auto removed in this iteration)
    hooks.btnEndure?.addEventListener("click", () => ctx.actions?.battle?.endure?.());
    hooks.btnChannel?.addEventListener("click", () => ctx.actions?.battle?.channel?.());

    function renderEnemyPips(encounters) {
      if (!hooks.worldEnemies) return;
      hooks.worldEnemies.innerHTML = "";

      const list = Array.isArray(encounters) ? encounters.slice(0, 3) : [];
      for (const e of list) {
        const pip = document.createElement("div");
        pip.className = "wwEnemyPip";
        pip.textContent = e?.label ?? e?.name ?? "Enemy";
        hooks.worldEnemies.appendChild(pip);
      }
    }

    // Local target selection (V1 UI state)
    let selectedTargetIndex = 0;

    function renderBattleEnemies(encounters) {
      if (!hooks.battleEnemies) return;
      hooks.battleEnemies.innerHTML = "";

      const list = Array.isArray(encounters) ? encounters.slice(0, 3) : [];
      const padded = list.concat([null, null, null]).slice(0, 3);

      padded.forEach((e, idx) => {
        const card = document.createElement("div");
        card.className = "wwEnemyCard";
        card.classList.toggle("isTarget", idx === selectedTargetIndex);

        if (!e) {
          card.innerHTML = `<b>—</b><div class="muted">empty</div>`;
        } else {
          const nm = e.name ?? e.label ?? "Enemy";
          const pressure = e.pressure ?? e.pressureTotal ?? "?";
          card.innerHTML = `<b>${nm}</b><div class="muted">Pressure: ${pressure}</div>`;
          card.addEventListener("click", () => {
            selectedTargetIndex = idx;
            const stage = ctx.vm.getMapped("stage");
            render(stage);
          });
        }

        hooks.battleEnemies.appendChild(card);
      });
    }

    function renderBattleLog(lines) {
      if (!hooks.battleLog) return;
      hooks.battleLog.innerHTML = "";

      const list = Array.isArray(lines) ? lines.slice(-14).reverse() : [];
      if (!list.length) {
        const div = document.createElement("div");
        div.className = "line";
        div.textContent = "No battle log yet.";
        hooks.battleLog.appendChild(div);
        return;
      }

      for (const line of list) {
        const div = document.createElement("div");
        div.className = "line";
        div.textContent = line;
        hooks.battleLog.appendChild(div);
      }
    }

    function render(stage) {
      const mode = stage?.mode ?? "patrol";
      const battleOpen = !!stage?.battleOpen;

      // Header text
      if (hooks.title) hooks.title.textContent = mode === "battle" ? "Wardwatch — Encounter" : "Wardwatch — All quiet";
      if (hooks.subtitle) {
        hooks.subtitle.textContent =
          mode === "battle"
            ? "A disturbance presses against the wardline. Intervene, or let your setup handle it."
            : "The ward holds. Soft embers drift on the skyline.";
      }

      // Determine if an encounter exists
      const hasEncounter = mode === "battle";

      // CTA visible when encounter exists and battle UI isn't open yet
      hooks.btnAid?.classList.toggle("isHidden", !hasEncounter || battleOpen);

      // World caption
      if (hooks.worldCaption) hooks.worldCaption.textContent = hasEncounter ? "Encounter present — manual window open" : "Patrol view — ambient";

      // Loadout auto label (still shown on loadout page)
      hooks.loadoutAuto && (hooks.loadoutAuto.textContent = stage?.auto ? "ON" : "OFF");

      // Switch normal vs battle UI
      hooks.normalWrap?.classList.toggle("isHidden", battleOpen);
      hooks.battleWrap?.classList.toggle("isActive", battleOpen);

      if (battleOpen) {
        // ATB fill: expects stage.atbPct (0..1) or stage.atb (0..100). Falls back to 0.
        let pct = 0;
        if (typeof stage?.atbPct === "number") pct = stage.atbPct;
        else if (typeof stage?.atb === "number") pct = stage.atb / 100;
        pct = Math.max(0, Math.min(1, pct));

        if (hooks.atbFill) hooks.atbFill.style.width = `${pct * 100}%`;

        renderBattleEnemies(stage?.encounters);
        renderBattleLog(stage?.battleLog);

        // Optional: battle portrait could come from VM later (image/VFX). For now keep "AZ"
        if (hooks.battlePortrait && stage?.portraitText) hooks.battlePortrait.textContent = String(stage.portraitText);
      } else {
        renderEnemyPips(stage?.encounters);
        setActiveTab("world");
      }
    }

    // Watch stage
    const unwatchStage = ctx.vm.watchMapped("stage", (stage) => render(stage));

    // initial
    render(ctx.vm.getMapped("stage"));

    return {
      destroy() {
        unwatchStage?.();
        el.innerHTML = "";
      },
    };
  },
};

export default WardwatchStage;
