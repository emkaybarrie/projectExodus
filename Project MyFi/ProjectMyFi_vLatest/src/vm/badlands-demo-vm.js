// badlands-demo-vm.js — VM data for Badlands entry screen
// Provides subscription-based theming and loadout data

/**
 * Get demo VM data for Badlands entry screen
 * Data is keyed by slot ID (content)
 */
export function getBadlandsDemoVM() {
  return {
    // Slot: content (BadlandsEntry part)
    content: {
      // Subscription level determines portal background
      subscriptionLevel: 'gold', // 'free', 'silver', 'gold'

      // Avatar info
      avatar: {
        name: 'Wanderer',
        level: 5,
        class: 'Budgeteer',
      },

      // Loadout preview
      loadout: {
        weapon: 'Discipline Edge',
        armor: 'Saver\'s Mail',
        charm: 'Focus Gem',
      },

      // Portal theme (derived from subscriptionLevel)
      portalTheme: 'frontier', // Matches subscription: free=frontier, silver=badlands, gold=void

      // Activity stats
      stats: {
        activePlayers: 127,
        totalEssence: 45280,
        essenceByRegion: {
          frontier: 18500,
          badlands: 15780,
          void: 11000,
        },
      },

      // Leaderboard (top runners)
      leaderboard: [
        { rank: 1, name: 'SavingsKing', score: 984500, region: 'void' },
        { rank: 2, name: 'BudgetNinja', score: 872300, region: 'badlands' },
        { rank: 3, name: 'FrugalMaster', score: 756100, region: 'void' },
        { rank: 4, name: 'CoinCollector', score: 698400, region: 'frontier' },
        { rank: 5, name: 'SpendSmart', score: 645200, region: 'badlands' },
      ],
    },
  };
}

/**
 * Get subscription level from session or config
 * In production, this would read from actual session state
 */
export function getSubscriptionLevel() {
  // Check dev config override
  const devConfig = typeof window !== 'undefined' ? window.__MYFI_DEV_CONFIG__ : null;
  if (devConfig?.subscriptionLevel) {
    return devConfig.subscriptionLevel;
  }

  // Default to free tier
  return 'free';
}

/**
 * Map subscription level to portal theme
 */
export function getPortalThemeForSubscription(subscriptionLevel) {
  const themeMap = {
    free: 'frontier',
    silver: 'badlands',
    gold: 'void',
  };
  return themeMap[subscriptionLevel] || 'frontier';
}

export default { getBadlandsDemoVM, getSubscriptionLevel, getPortalThemeForSubscription };
