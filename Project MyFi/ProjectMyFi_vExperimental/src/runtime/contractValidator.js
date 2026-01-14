// Contract guardrails for Parts (dev-time safety).
//
// Contract model:
// - bindRequired: array of bind keys that must be provided by surface placement
// - actionsAllowed: list of action names that part is allowed to call
// - (optional) hooks/classes/ids maps for styling, not enforced here
//
// Runtime behavior:
// - wrapCtxWithContract exposes:
//   - vm.getMapped(key): reads vm.get(bind[key]) only if key is in bindRequired
//   - vm.watchMapped(key, cb): same, watched
//   - actions: proxy that blocks calls not in actionsAllowed

export function loadContractForPart(partId) {
  // Convention: contract lives at /src/parts/<PartId>/contract.json
  return fetch(`./src/parts/${partId}/contract.json`).then(async (r) => {
    if (!r.ok) throw new Error(`Missing contract.json for part: ${partId}`);
    return r.json();
  });
}

export function validatePlacementAgainstContract({ partId, contract, bind, screenDir }) {
  const errors = [];

  const required = Array.isArray(contract?.bindRequired) ? contract.bindRequired : [];
  for (const key of required) {
    if (!bind || typeof bind[key] !== "string" || !bind[key].trim()) {
      errors.push(
        `[surface] ${screenDir}: placement for part "${partId}" is missing required bind "${key}".`
      );
    }
  }

  if (bind && typeof bind === "object") {
    for (const [k, v] of Object.entries(bind)) {
      if (typeof v !== "string") {
        errors.push(
          `[surface] ${screenDir}: placement for part "${partId}" bind "${k}" must be a string VM path. Got ${typeof v}.`
        );
      }
    }
  }

  return errors;
}

export function wrapCtxWithContract({ ctx, partId, contract, bind }) {
  const allowedActions = new Set(contract.actionsAllowed || []);
  const requiredBinds = new Set(contract.bindRequired || []);

  const actionsProxy = new Proxy(ctx.actions, {
    get(target, prop) {
      // Support namespaces: actions.hub.openLoadout etc
      const val = target[prop];
      if (typeof val === "object" && val !== null) return val;

      // If root prop is a function, treat as action name
      if (typeof val === "function") {
        const name = String(prop);
        if (!allowedActions.has(name)) {
          return (...args) => {
            console.warn(`[guardrails] Blocked action "${name}" from part "${partId}"`, args);
          };
        }
        return val;
      }
      return val;
    }
  });

  // Deep proxy for namespaced calls e.g. actions.hub.openLoadout
  function makeDeepActionsProxy(obj, prefix = "") {
    return new Proxy(obj, {
      get(target, prop) {
        const v = target[prop];
        const name = prefix ? `${prefix}.${String(prop)}` : String(prop);
        if (typeof v === "function") {
          if (!allowedActions.has(name)) {
            return (...args) => console.warn(`[guardrails] Blocked action "${name}" from part "${partId}"`, args);
          }
          return v;
        }
        if (typeof v === "object" && v !== null) {
          return makeDeepActionsProxy(v, name);
        }
        return v;
      }
    });
  }

  const guarded = {
    ...ctx,
    actions: makeDeepActionsProxy(ctx.actions),
    vm: {
      ...ctx.vm,
      getMapped(bindKey) {
        if (!requiredBinds.has(bindKey)) {
          console.warn(`[guardrails] Part "${partId}" attempted to read unmapped bind "${bindKey}"`);
          return undefined;
        }
        return ctx.vm.get(bind[bindKey]);
      },
      watchMapped(bindKey, cb) {
        if (!requiredBinds.has(bindKey)) {
          console.warn(`[guardrails] Part "${partId}" attempted to watch unmapped bind "${bindKey}"`);
          return () => {};
        }
        return ctx.vm.watch(bind[bindKey], cb);
      }
    }
  };

  return guarded;
}
