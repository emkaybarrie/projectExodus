// quests/events.js
const listeners = new Map();

export function on(eventName, fn) {
  if (!listeners.has(eventName)) listeners.set(eventName, new Set());
  listeners.get(eventName).add(fn);
  return () => listeners.get(eventName)?.delete(fn);
}

export function emit(eventName, payload = {}) {
  const fns = listeners.get(eventName);
  if (!fns) return;
  for (const fn of fns) {
    try { fn(payload); } catch (e) { console.warn(`[events] handler error: ${eventName}`, e); }
  }
}

// Canonical quest events
export const QuestEvents = {
  INCOME_SET: "INCOME_SET",
  WARDFIRE_SET: "WARDFIRE_SET",
  AVATAR_FORMED: "AVATAR_FORMED",
  TRUELAYER_CONNECTED: "TRUELAYER_CONNECTED",
  FIRST_TX_TAGGED: "FIRST_TX_TAGGED",
  ALL_SCREENS_VISITED: "ALL_SCREENS_VISITED",
  FIRST_SKILL_USED: "FIRST_SKILL_USED",
  ESSENCE_CONTRIBUTION_MADE: "ESSENCE_CONTRIBUTION_MADE",
  CREDITS_PURCHASED: "CREDITS_PURCHASED",
  AVATAR_EMPOWERED: "AVATAR_EMPOWERED",
  FRIEND_INVITE_CONVERTED: "FRIEND_INVITE_CONVERTED",
  FRIEND_ADDED: "FRIEND_ADDED",
  BADLANDS_ENTERED: "BADLANDS_ENTERED",
  HUB_MUSIC_LISTENED_FULL: "HUB_MUSIC_LISTENED_FULL",
};
