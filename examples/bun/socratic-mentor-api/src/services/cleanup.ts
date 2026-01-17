import { StateManager } from "../lib/state.js";

/**
 * Starts the background pruning service to remove expired sessions.
 * @param stateManager The state manager instance
 * @param intervalMs How often to run the cleanup (ms)
 * @param maxAgeSeconds Max age of sessions to keep (seconds)
 */
export function startPruningService(
    stateManager: StateManager,
    intervalMs: number,
    maxAgeSeconds: number
) {
    // Run immediately on start? Maybe not needed.

    const interval = setInterval(() => {
        try {
            const deleted = stateManager.prune(maxAgeSeconds);
            if (deleted > 0) {
                console.log(`[Lifecycle] Pruned ${deleted} expired sessions.`);
            }
        } catch (e) {
            console.error("[Lifecycle] Pruning failed:", e);
        }
    }, intervalMs);

    // Return a dispose function if needed in future, though usually runs forever
    return () => clearInterval(interval);
}
