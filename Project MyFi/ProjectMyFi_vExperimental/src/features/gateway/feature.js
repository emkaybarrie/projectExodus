/**
 * Feature Pack: gateway
 * Responsibility: Thin IO around the "vitals gateway" Firestore doc:
 * - read once
 * - refresh (recompute stub) + read
 * - watch (onSnapshot)
 * - resolve data sources (tx paths etc.)
 *
 * This is shared capability. Screens should call this API instead of importing
 * hub modules directly once migration is complete.
 *
 * NOTE: This is a wrapper (Phase 2A). Behaviour should remain unchanged.
 */
import * as gatewayIO from './io.js';

export const gatewayFeature = {
  id: 'gateway',
  api: {
    /** Read the gateway doc once */
    getOnce: gatewayIO.getGatewayOnce,

    /** Force recompute stub, then read once */
    refreshAndGet: gatewayIO.refreshAndGetGateway,

    /**
     * Watch gateway doc; callback-first for ergonomics.
     * Returns unsubscribe() (awaited because underlying is async)
     */
    watch: async (cb, uid) => gatewayIO.watchGateway(uid, cb),

    /** Expose tx path + source resolution */
    resolveDataSources: gatewayIO.resolveDataSources
  }
};

export default gatewayFeature;
