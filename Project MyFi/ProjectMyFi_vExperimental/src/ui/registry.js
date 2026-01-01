// src/ui/registry.js
// Single, canonical resolver for Surface "parts".
//
// IMPORTANT:
// - "Primitives" and "Prefabs" are design categories.
// - "Parts" are *mountable* units referenced from surface.json via `kind`.
// - Some parts may be screen-local (e.g., Quests screen sections).
//
// This file exists so we do NOT need a third UI folder like `ui/parts/`.

/**
 * Resolve a surface `kind` to a part factory.
 * A part factory has the signature: (host, {id, kind, props, ctx}) => { unmount? }
 */
export async function resolvePart(kind){
  switch (kind) {
    // ----- Quests screen (Model A: controller owns state; surface composes parts) -----
    case 'QuestsHeader':
      return (await import('../screens/quests/parts/QuestsHeaderPart.js')).QuestsHeaderPart;
    case 'QuestsTabs':
      return (await import('../screens/quests/parts/QuestsTabsPart.js')).QuestsTabsPart;
    case 'QuestSection':
      return (await import('../screens/quests/parts/QuestSectionPart.js')).QuestSectionPart;

    default:
      throw new Error(`resolvePart: unknown kind "${kind}"`);
  }
}
