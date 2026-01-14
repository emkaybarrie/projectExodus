import { createVM } from "./core/vm.js";
import { getDataMode } from "./core/dataMode.js";
import { makeDemoHubVM } from "./dev/demo-vm.js";

import { createPartRegistry } from "./runtime/partRegistry.js";
import { createScreenLoader } from "./runtime/screenLoader.js";
import { createRenderer } from "./runtime/renderer.js";

async function main() {
  const root = document.getElementById("app");

  // 1) VM source (demo now; real later)
  const mode = getDataMode();
  const initial = mode === "demo" ? makeDemoHubVM() : makeDemoHubVM(); // placeholder for real adapter
  const vm = createVM(initial);

  // 2) Actions (demo stubs; later route to feature APIs)
  const actions = {
    hub: {
      openLoadout: () => console.log("[action] hub.openLoadout"),
      openRecent: () => console.log("[action] hub.openRecent"),
      enterBattle: () => {
        // Stage-level switch: World/Patrol → Battle Mode (player present)
        vm.set("hub.stage.battleOpen", true);
      },
      exitBattle: () => {
        vm.set("hub.stage.battleOpen", false);
      },
      
    },
    battle: {
      endure: () => console.log("[action] battle.endure"),
      channel: () => console.log("[action] battle.channel"),
      toggleAuto: () => {
        const cur = !!vm.get("hub.stage.auto");
        vm.set("hub.stage.auto", !cur);
      }
    }
  };

  // 3) Runtime
  const registry = createPartRegistry();
  const loader = createScreenLoader();
  const renderer = createRenderer({ registry, loader });

  // 4) Mount a screen surface
  await renderer.mountScreen({
    root,
    screenDir: "./src/screens/hub-wardwatch/",
    ctx: { vm, actions }
  });

  // Dev hook
  window.__DEV__ = { vm, actions, renderer };
}

main().catch(err => {
  console.error(err);
  document.getElementById("app").innerHTML =
    `<pre style="color:#fff;padding:12px;">Boot error: ${String(err)}</pre>`;
});
