import { StateManager } from "../lib/state.js";

/**
 * Minimum retention period for payment records (90 days in seconds).
 * Records are kept for customer service needs even after balance is depleted.
 */
export const PAYMENT_RETENTION_SECONDS = 60 * 60 * 24 * 90; // 90 days

/**
 * Starts the background pruning service to remove expired sessions and old payments.
 * @param stateManager The state manager instance
 * @param intervalMs How often to run the cleanup (ms)
 * @param maxAgeSeconds Max age of sessions to keep (seconds)
 */
export function startPruningService(
    stateManager: StateManager,
    intervalMs: number,
    maxAgeSeconds: number
) {
    const interval = setInterval(() => {
        try {
            // Prune expired sessions
            const deletedSessions = stateManager.prune(maxAgeSeconds);
            if (deletedSessions > 0) {
                console.log(`[Lifecycle] Pruned ${deletedSessions} expired sessions.`);
            }

            // Prune old payment records (only if wallet has zero balance)
            const deletedPayments = stateManager.prunePayments(PAYMENT_RETENTION_SECONDS);
            if (deletedPayments > 0) {
                console.log(`[Lifecycle] Pruned ${deletedPayments} old payment records (zero-balance wallets).`);
            }
        } catch (e) {
            console.error("[Lifecycle] Pruning failed:", e);
        }
    }, intervalMs);

    // Return a dispose function if needed in future, though usually runs forever
    return () => clearInterval(interval);
}

