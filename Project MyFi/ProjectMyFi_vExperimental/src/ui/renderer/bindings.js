function getByPath(obj, path) {
  if (!obj || !path) return undefined;
  const parts = path.split('.').filter(Boolean);
  let cur = obj;
  for (const p of parts) {
    if (cur == null) return undefined;
    cur = cur[p];
  }
  return cur;
}

/**
 * Extract args from mapping:
 *  { questId: "$event.item.id", tabId:"$event.tabId", foo:123 }
 */
export function buildArgs(argSpec, ctx) {
  if (!argSpec) return {};
  const out = {};
  for (const [k, v] of Object.entries(argSpec)) {
    if (typeof v === 'string' && v.startsWith('$')) {
      // Supported:
      // $event.x
      // $event.item.id
      const keyPath = v.slice(1); // remove $
      const [root, ...rest] = keyPath.split('.');
      if (root === 'event') out[k] = getByPath(ctx.event, rest.join('.'));
      else out[k] = undefined;
    } else {
      out[k] = v;
    }
  }
  return out;
}

/**
 * Route part events to actions:
 * events: { "change": { action:"quests.setActiveTab", args:{tabId:"$event.tabId"} } }
 */
export async function routeEvent({ eventsMap, eventName, eventDetail, actions }) {
  if (!eventsMap) return;
  const binding = eventsMap[eventName];
  if (!binding) return;

  const actionName = binding.action;
  const fn = actions?.[actionName];
  if (typeof fn !== 'function') {
    console.warn('[surfaceRenderer] missing action:', actionName);
    return;
  }

  const args = buildArgs(binding.args, { event: eventDetail || {} });
  return fn(args);
}
