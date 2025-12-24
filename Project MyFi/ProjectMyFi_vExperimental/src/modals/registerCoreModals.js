/**
 * Register core modals
 * This centralizes imports of modal openers so screens/journeys never import modal paths directly.
 */
import { registerModalOpener } from './registry.js';

// Import your real modal openers (match your existing project paths)
import { openProfileModal } from './profile.js';

import { openEnergyMenu } from './energyMenu/energy-menu.js';
import { openSpiritMenu } from './spirit.js';
import { openSpiritStoneModal } from './spiritstone.js';

// Optional/common modals used by header menu
import { openSettingsModal } from './settings.js';
import { openHelpModal } from './help.js';
import { openLogoutConfirmModal } from './logout.js';
import { openSocialModal } from './social.js';
import { openFullMusicList } from './musicPlayer.js';

// Optional: if you want the "example standard modal" available
import { openExampleStandardModal } from './modal-template.js';

export function registerCoreModals() {
  // Hub core
  registerModalOpener('profile', (args, ctx) => openProfileModal(args?.owner ?? 'hub'));
  registerModalOpener('energyMenu', (args, ctx) => openEnergyMenu(args, ctx));
  registerModalOpener('spiritMenu', (args, ctx) => openSpiritMenu(args, ctx));
  registerModalOpener('spiritStoneMenu', (args, ctx) => openSpiritStoneModal(args?.owner ?? 'hub'));

  // Header menu / general
  registerModalOpener('settings', (args, ctx) => openSettingsModal(args, ctx));
  registerModalOpener('help', (args, ctx) => openHelpModal(args, ctx));
  registerModalOpener('logout', (args, ctx) => openLogoutConfirmModal(args, ctx));
  registerModalOpener('social', (args, ctx) => openSocialModal(args, ctx));
  registerModalOpener('music', (args, ctx) => openFullMusicList(args, ctx));

  // Optional
  registerModalOpener('exampleStandard', (args, ctx) => openExampleStandardModal(args?.owner ?? 'hub'));
}
