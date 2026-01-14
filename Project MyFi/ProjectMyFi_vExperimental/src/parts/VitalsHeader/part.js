import { ensureCssLink, fetchText, mapHooks } from "../../runtime/assetLoader.js";

export default {
  async mount({ el, bind, ctx }) {
    await ensureCssLink(
      "./src/parts/VitalsHeader/uplift.css",
      "css-VitalsHeader"
    );

    el.innerHTML = await fetchText("./src/parts/VitalsHeader/baseline.html");

    const root = el.querySelector(".Part-VitalsHeader");
    const hooks = mapHooks(root);

    const vitalsPath = bind.vitals;

    function setBar(fillEl, valEl, cur, max){
      const c = Number(cur ?? 0);
      const m = Number(max ?? 0);
      const pct = m ? Math.max(0, Math.min(100, (c/m)*100)) : 0;
      fillEl.style.width = `${pct}%`;
      valEl.textContent = `${c} / ${m}`;
    }

    function render() {
      const v = ctx.vm.get(vitalsPath);
      if (!v) return;

      setBar(hooks.fillHealth, hooks.valHealth, v.health?.cur, v.health?.max);
      setBar(hooks.fillMana,   hooks.valMana,   v.mana?.cur,   v.mana?.max);
      setBar(hooks.fillStam,   hooks.valStam,   v.stam?.cur,   v.stam?.max);
      setBar(hooks.fillShield, hooks.valShield, v.shield?.cur, v.shield?.max);
    }

    const unsub = ctx.vm.subscribe((changed) => {
      if (changed.startsWith(vitalsPath)) render();
    });

    render();

    return { destroy(){ unsub(); } };
  }
};
