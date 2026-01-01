// src/ui/parts/QuestBoard.js
// Compatibility wrapper.
//
// In the v12 schema, QuestBoard is a Screen Part (orchestrator) for the Quests screen.
// The implementation lives under:
//   src/screens/quests/parts/QuestBoardPart.js
//
// It remains mountable as a "kind" via the parts registry (QuestBoard).

export { QuestBoardPart } from '../../screens/quests/parts/QuestBoardPart.js';
