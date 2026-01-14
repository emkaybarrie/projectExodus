import { ensureCssLink, fetchText, mapHooks } from "../../runtime/assetLoader.js";

export default {
  async mount({ el, bind, ctx }) {
    await ensureCssLink(
      "./src/parts/EssenceFooter/uplift.css",
      "css-EssenceFooter"
    );

    el.innerHTML = await fetchText("./src/parts/EssenceFooter/baseline.html");

    const root = el.querySelector(".Part-EssenceFooter");
    const hooks = mapHooks(root);

    const essencePath = bind.essence;

    function render(){
      const e = ctx.vm.get(essencePath);
      if (!e) return;
      hooks.essenceVal.textContent = `${e.cur} / ${e.max}`;
    }

    const unsub = ctx.vm.subscribe((changed) => {
      if (changed.startsWith(essencePath)) render();
    });

    render();
    return { destroy(){ unsub(); } };
  }
};
