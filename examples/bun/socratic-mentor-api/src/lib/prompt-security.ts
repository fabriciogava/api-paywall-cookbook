/**
 * Security utilities for protecting against prompt injection attacks.
 * 
 * Prompt injection occurs when user input contains instructions that attempt to
 * override the system prompt or manipulate the AI's behavior.
 */

/**
 * Unique delimiter to mark boundaries between system instructions and user input.
 * Using a complex pattern that's unlikely to appear in natural user input.
 * 
 * Why this matters:
 * By clearly marking where "User Input" begins and ends, we help the model distinguish
 * between "Instructions to follow" and "Data to process".
 */
export const PROMPT_DELIMITER = "====USER_INPUT_BOUNDARY====";

/**
 * Escapes user input to prevent prompt injection attacks.
 * 
 * This function:
 * 1. Removes delimiter patterns that could break input boundaries
 * 2. Filters section header patterns that could inject fake system instructions
 * 
 * @param input - Raw user input to escape
 * @returns Escaped input safe for inclusion in prompts
 */
export function escapeForPrompt(input: string): string {
    if (!input || typeof input !== 'string') {
        return '';
    }

    return input
        // Remove any delimiter patterns to prevent boundary breaking
        .replace(/====.*?====/g, '[FILTERED]')
        // Remove section header patterns like [System:], [Instructions:], etc.
        .replace(/\[.*?\]:/g, '[FILTERED]')
        // Remove common prompt injection keywords (case insensitive)
        .replace(/ignore\s+(all\s+)?(previous|prior|above)\s+(instructions?|prompts?|rules?)/gi, '[FILTERED]')
        .replace(/new\s+(system\s+)?(prompt|instructions?|rules?)/gi, '[FILTERED]')
        .replace(/you\s+are\s+now/gi, '[FILTERED]')
        .replace(/disregard\s+(all\s+)?(previous|prior|above)/gi, '[FILTERED]');
}

/**
 * Wraps user input with security delimiters and escape sequences.
 * 
 * @param input - Raw user input
 * @returns Securely wrapped input with delimiters and escape applied
 */
export function wrapUserInput(input: string): string {
    const escaped = escapeForPrompt(input);
    return `${PROMPT_DELIMITER}\n${escaped}\n${PROMPT_DELIMITER}`;
}
