// ---FILE: src/app/boot.js
import { createRuntime } from "./runtime.js";

const root = document.getElementById("app");
const rt = await createRuntime({
  appRootEl: root,
  manifestUrl: "./src/registry/manifest.json",
  vmModuleUrl: "./src/vm/demo-vm.js",
});

await rt.start();

// Expose a tiny dev hook (optional, harmless)
window.__MYFI__ = {
  rt,
  goto: (surfaceId) => rt.router.goto(surfaceId),
};
