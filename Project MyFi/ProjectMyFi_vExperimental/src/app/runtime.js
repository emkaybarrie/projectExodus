// ---FILE: src/app/runtime.js
import { createRouter } from "./router.js";

function errCard(title, msg){
  const el = document.createElement("div");
  el.className = "MyFiErrorCard";
  el.innerHTML = `
    <div class="MyFiErrorCard__title">${escapeHtml(title)}</div>
    <p class="MyFiErrorCard__msg">${escapeHtml(msg)}</p>
  `;
  return el;
}

function escapeHtml(s){
  return String(s)
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

/**
 * IMPORTANT (Forge v1):
 * - Any URL strings stored in manifest.json (e.g. "./src/parts/X/part.js")
 *   must be resolved relative to the *document* (index.html), not relative to
 *   this module (src/app/runtime.js).
 * - Otherwise the browser will try to load "src/app/src/..." and 404.
 */
function resolveUrl(spec){
  return new URL(spec, document.baseURI).href;
}

async function fetchJson(urlSpec){
  const url = resolveUrl(urlSpec);
  const res = await fetch(url, { cache: "no-store" });
  if(!res.ok) throw new Error(`Failed to fetch JSON: ${urlSpec} (${res.status})`);
  return await res.json();
}

async function fetchText(urlSpec){
  const url = resolveUrl(urlSpec);
  const res = await fetch(url, { cache: "no-store" });
  if(!res.ok) throw new Error(`Failed to fetch text: ${urlSpec} (${res.status})`);
  return await res.text();
}

function buildHooksMap(rootEl){
  const map = {};
  const nodes = rootEl.querySelectorAll("[data-hook]");
  nodes.forEach(n => { map[n.getAttribute("data-hook")] = n; });
  return map;
}

export async function createRuntime({ appRootEl, manifestUrl, vmModuleUrl }){
  const state = {
    manifest: null,
    vm: null,
    vmModuleUrl,
    activeSurfaceId: null,
  };

  const router = createRouter({
    onRoute: async (surfaceId) => {
      await renderSurface(surfaceId);
    }
  });

  async function loadManifest(){
    state.manifest = await fetchJson(manifestUrl);
    if(!state.manifest || !state.manifest.parts || !state.manifest.surfaces){
      throw new Error(`Manifest missing required keys (parts, surfaces). Got: ${JSON.stringify(Object.keys(state.manifest||{}))}`);
    }
  }

  async function loadVM(){
    // Resolve relative to document base so vmModuleUrl can be "./src/vm/demo-vm.js"
    const mod = await import(resolveUrl(vmModuleUrl));
    if(typeof mod.getInitialVM !== "function"){
      throw new Error(`VM module must export getInitialVM(). Missing in ${vmModuleUrl}`);
    }
    state.vm = mod.getInitialVM();
  }

  function clearAppRoot(){
    appRootEl.innerHTML = "";
  }

  function getPartEntry(partId){
    const entry = state.manifest.parts?.[partId];
    if(!entry) throw new Error(`Unknown partId: ${partId}`);
    return entry;
  }

  function getSurfaceEntry(surfaceId){
    const entry = state.manifest.surfaces?.[surfaceId];
    if(!entry) throw new Error(`Unknown surfaceId: ${surfaceId}`);
    return entry;
  }

  async function loadPartModule(partId){
    const entry = getPartEntry(partId);
    if(!entry.module) throw new Error(`Part "${partId}" missing manifest.parts[${partId}].module`);
    // Resolve relative to document base, not runtime.js
    return await import(resolveUrl(entry.module));
  }

  async function loadPartContract(partId){
    const entry = getPartEntry(partId);
    if(!entry.contract) throw new Error(`Part "${partId}" missing manifest.parts[${partId}].contract`);
    return await fetchJson(entry.contract);
  }

  async function loadPartBaselineHtml(partId){
    const entry = getPartEntry(partId);
    if(!entry.baseline) throw new Error(`Part "${partId}" missing manifest.parts[${partId}].baseline`);
    return await fetchText(entry.baseline);
  }

  async function loadPartUpliftCss(partId){
    const entry = getPartEntry(partId);
    if(!entry.upliftCss) return null;
    try { return await fetchText(entry.upliftCss); }
    catch { return null; }
  }

  async function renderPartInto({ partId, mountEl, vmSlice, runtimeActions }){
    try{
      const [mod, contract, baselineHtml, upliftCss] = await Promise.all([
        loadPartModule(partId),
        loadPartContract(partId),
        loadPartBaselineHtml(partId),
        loadPartUpliftCss(partId),
      ]);

      if(typeof mod.mount !== "function"){
        throw new Error(`Part module must export mount(ctx). Missing in: ${getPartEntry(partId).module}`);
      }

      // Inject baseline HTML
      mountEl.innerHTML = baselineHtml;

      // Inject uplift CSS (scoped by convention: part root class)
      if(upliftCss){
        const style = document.createElement("style");
        style.setAttribute("data-myfi-uplift", partId);
        style.textContent = upliftCss;
        mountEl.appendChild(style);
      }

      const rootEl = mountEl.firstElementChild || mountEl;
      const hooks = buildHooksMap(rootEl);

      // Lightweight runtime guardrail: ensure required hooks exist
      if(contract?.hooks?.required?.length){
        for(const hk of contract.hooks.required){
          if(!hooks[hk]){
            throw new Error(`Part "${partId}" baseline missing required hook: "${hk}"`);
          }
        }
      }

      // mount
      const ctx = {
        partId,
        rootEl,
        hooks,
        vm: vmSlice,
        actions: runtimeActions,
        contract,
        emit: (name, detail) => window.dispatchEvent(new CustomEvent(name, { detail })),
      };

      await mod.mount(ctx);

      return { ok:true };
    } catch(e){
      console.error(`[MyFi] Failed to render part "${partId}":`, e);
      mountEl.innerHTML = "";
      mountEl.appendChild(errCard(`Part failed: ${partId}`, String(e?.message || e)));
      return { ok:false, error:e };
    }
  }

  function resolveSlicePath(vm, slicePath){
    if(!slicePath) return vm;
    const parts = slicePath.split(".").filter(Boolean);
    let cur = vm;
    for(const p of parts){
      if(cur && Object.prototype.hasOwnProperty.call(cur, p)) cur = cur[p];
      else return null;
    }
    return cur;
  }

  function buildRuntimeActions(){
    // v1 baseline: a tiny action hub. Later, features register actions here.
    return {
      navigate: (surfaceId) => router.goto(surfaceId),
      toast: (msg) => console.log(`[MyFi Toast] ${msg}`),
    };
  }

  async function renderSurface(surfaceId){
    clearAppRoot();
    state.activeSurfaceId = surfaceId;

    let surface;
    try{
      const entry = getSurfaceEntry(surfaceId);
      surface = await fetchJson(entry.url);
    } catch(e){
      console.error(`[MyFi] Failed to load surface "${surfaceId}":`, e);
      appRootEl.appendChild(errCard(`Surface failed: ${surfaceId}`, String(e?.message || e)));
      return;
    }

    // Surface schema (minimal v1)
    const shellPartId = surface?.shell?.partId;
    if(!shellPartId){
      appRootEl.appendChild(errCard(`Surface invalid: ${surfaceId}`, `Missing shell.partId in surface JSON.`));
      return;
    }

    // Create shell host
    const shellHost = document.createElement("div");
    shellHost.setAttribute("data-surface-host", surfaceId);
    appRootEl.appendChild(shellHost);

    // Mount shell part (shell gets full VM)
    const actions = buildRuntimeActions();
    await renderPartInto({
      partId: shellPartId,
      mountEl: shellHost,
      vmSlice: state.vm,
      runtimeActions: actions,
    });

    // Find slots inside shell
    const slots = {};
    shellHost.querySelectorAll("[data-slot]").forEach(el => {
      slots[el.getAttribute("data-slot")] = el;
    });

    const placements = surface?.placements || [];
    for(const plc of placements){
      const slotEl = slots[plc.slot];
      if(!slotEl){
        const msg = `Slot "${plc.slot}" not found in shell "${shellPartId}". Available: ${Object.keys(slots).join(", ")}`;
        console.error(`[MyFi] ${msg}`);
        const ec = errCard("Surface placement error", msg);
        shellHost.appendChild(ec);
        continue;
      }

      const partMount = document.createElement("div");
      partMount.setAttribute("data-part-mount", plc.partId);
      slotEl.appendChild(partMount);

      const slice = resolveSlicePath(state.vm, plc.slicePath);
      await renderPartInto({
        partId: plc.partId,
        mountEl: partMount,
        vmSlice: slice,
        runtimeActions: actions,
      });
    }
  }

  return {
    router,
    get state(){ return state; },

    async start(){
      try{
        await loadManifest();
        await loadVM();

        const startSurface = state.manifest?.app?.startSurfaceId || "hub";
        router.start(startSurface);
      } catch(e){
        console.error("[MyFi] Fatal boot error:", e);
        clearAppRoot();
        appRootEl.appendChild(errCard("Boot failed", String(e?.message || e)));
      }
    },
  };
}
