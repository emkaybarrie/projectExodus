// src/ui/parts/registry.js
// Central part resolver (prefab parts registry).
//
// IMPORTANT: Parts are the only place where DOM wiring & behaviour lives.
// Surfaces only reference them by "kind".

import { QuestBoardPart } from './QuestBoard.js';

const PARTS = new Map([
  ['QuestBoard', QuestBoardPart],
]);

/** Resolve a part kind to a Part factory function. */
export async function resolvePart(kind) {
  return PARTS.get(kind) || null;
}
