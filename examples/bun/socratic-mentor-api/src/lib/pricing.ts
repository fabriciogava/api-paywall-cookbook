// =============================================================================
// PRICING CONFIGURATION - Adjust these values to change pricing
// =============================================================================

/**
 * Gemini 2.5 Flash pricing (as of Jan 2025):
 * - Input: $0.30 per 1M tokens
 * - Output: $0.30 per 1M tokens
 */
const GEMINI_COST_PER_TOKEN = 0.0000003; // $0.30 / 1,000,000

/**
 * Token estimates based on typical request/response sizes:
 * - System prompt: ~525 tokens
 * - Context (summary + goal + boilerplate): ~150 tokens
 * - History (6 messages × 500 chars max ÷ 4 chars/token): ~750 tokens
 * - Average user input: ~25 tokens
 * - Total input: ~1450 tokens
 * - Average output (reply + context_state + main_goal): ~190 tokens
 */
const ESTIMATED_INPUT_TOKENS = 1450;
const ESTIMATED_OUTPUT_TOKENS = 190;

/**
 * Profit margin multiplier (1.0 = 0% margin, 2.0 = 100% margin)
 * We set this to 2.0 to cover:
 * 1. Operational costs (servers, database)
 * 2. Failed payments (since we use Optimistic Service)
 * 3. Profit
 */
const MARGIN_MULTIPLIER = 2.0;

/**
 * Calculated base cost per request (input + output tokens × cost per token × margin)
 * This is the fixed cost component effectively.
 */
const COST_PER_REQUEST =
    (ESTIMATED_INPUT_TOKENS + ESTIMATED_OUTPUT_TOKENS) * GEMINI_COST_PER_TOKEN * MARGIN_MULTIPLIER;

/**
 * Characters per token ratio (for converting user input chars to tokens)
 */
const CHARS_PER_TOKEN = 4;

/**
 * Price per character of user input (with margin applied)
 */
const PRICE_PER_INPUT_CHAR = (GEMINI_COST_PER_TOKEN / CHARS_PER_TOKEN) * MARGIN_MULTIPLIER;

/**
 * Minimum price per request.
 * Set to $0.000001 (1 atomic unit) - the smallest possible USDC transaction (6 decimals).
 * We can use this low minimum because SKALE is gasless.
 * For networks with gas costs, increase this to cover transaction fees.
 */
const MINIMUM_PRICE = 0.000001; // $0.000001 = 1 atomic unit (smallest USDC transaction)

/**
 * Maximum characters per message stored in history.
 * Prevents large messages from causing unprofitable carry-forward costs.
 * History keeps 6 messages, so max history size = 6 × this value.
 * Adjust ESTIMATED_INPUT_TOKENS if you change this.
 */
export const MAX_HISTORY_MESSAGE_CHARS = 500;

/**
 * Maximum number of messages (user + model pairs) to keep in history.
 * Used in .slice(-N) to retain the most recent messages.
 * Adjust ESTIMATED_INPUT_TOKENS if you change this.
 */
export const MAX_HISTORY_MESSAGES = 6;

// =============================================================================
// Exported default pricing config
// =============================================================================

export const DEFAULT_PRICING_CONFIG: PricingConfig = {
    pricePerChar: PRICE_PER_INPUT_CHAR,
    baseCost: COST_PER_REQUEST,
    estimatedContextChars: 0, // Already factored into baseCost
    minimumPrice: MINIMUM_PRICE
};

// =============================================================================
// Types and Functions
// =============================================================================

export interface PricingConfig {
    pricePerChar: number;        // Cost per character of input
    baseCost: number;            // Fixed base cost (e.g., for estimated output)
    estimatedContextChars: number; // Fixed estimation for context tokens
    minimumPrice: number;        // Minimum price floor to cover gas costs
}

/**
 * Calculates the dynamic price for a request based on input size and estimated context.
 * Formula: (InputChars + EstimatedContextChars) * PricePerChar + BaseCost
 * 
 * Note: We use a fixed context estimation because:
 * 1. We can't identify the user until after payment verification (Chicken & Egg problem).
 *    We don't know their history size yet.
 * 2. Progressive summary keeps context size relatively stable across sessions, so an average is safe.
 * 3. It provides a predictable price for the user before they pay.
 */
export function calculatePrice(
    input: string,
    config: PricingConfig = DEFAULT_PRICING_CONFIG
): number {
    const totalChars = input.length + config.estimatedContextChars;
    const variableCost = totalChars * config.pricePerChar;
    const calculatedPrice = variableCost + config.baseCost;
    return Math.max(calculatedPrice, config.minimumPrice);
}

/**
 * Converts a numeric price (e.g., 0.001) to atomic units string (e.g., "1000")
 * handling floating point precision safely.
 */
export function priceToAtomicUnits(price: number, decimals: number): string {
    // Use Math.round to handle floating point precision issues (e.g. 0.001 * 1e6 = 999.999...)
    const atomicUnits = Math.round(price * Math.pow(10, decimals));
    return atomicUnits.toString();
}

/**
 * Formats a price as a currency string (e.g. "$0.0005")
 * Useful since x402 usually expects a dollar string for simple fixed prices,
 * though for dynamic pricing we'll often use atomic units directly.
 */
export function formatPrice(price: number): string {
    return `$${price.toFixed(6)}`; // 6 decimal places is standard for USDC micropayments
}

/**
 * Truncates a message to the maximum allowed history message length.
 * Prevents large messages from causing unprofitable carry-forward costs.
 * 
 * @param text - The message text to truncate
 * @returns Truncated text with ellipsis if needed
 */
export function truncateHistoryMessage(text: string): string {
    return text.length > MAX_HISTORY_MESSAGE_CHARS
        ? text.slice(0, MAX_HISTORY_MESSAGE_CHARS) + "..."
        : text;
}
