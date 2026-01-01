// src/ui/parts/ObjectiveCard.js
// Compatibility wrapper so callers can keep importing from './ObjectiveCard.js'.
//
// In the v12 schema, ObjectiveCard is a Prefab (composite) that lives under:
//   src/ui/prefabs/ObjectiveCard/
//
// Wiring remains locked in part.js; uplifts live alongside it (uplift.css / uplift.html).

export { preloadObjectiveCardTemplate, renderObjectiveCard } from '../prefabs/ObjectiveCard/part.js';
