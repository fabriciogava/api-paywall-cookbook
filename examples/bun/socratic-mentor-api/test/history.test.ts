import { describe, it, expect } from "bun:test";
import { MAX_HISTORY_MESSAGE_CHARS } from "../src/lib/pricing.js";

/**
 * Tests for history truncation logic.
 * The truncation function is defined in ask.ts, but we test the logic here.
 */
describe("History Truncation Logic", () => {
    // Replicate the truncation function from ask.ts
    const truncate = (text: string) =>
        text.length > MAX_HISTORY_MESSAGE_CHARS
            ? text.slice(0, MAX_HISTORY_MESSAGE_CHARS) + "..."
            : text;

    it("should not truncate messages shorter than MAX_HISTORY_MESSAGE_CHARS", () => {
        const shortMessage = "Hello, this is a short message.";
        expect(truncate(shortMessage)).toBe(shortMessage);
    });

    it("should not truncate messages exactly at MAX_HISTORY_MESSAGE_CHARS", () => {
        const exactMessage = "a".repeat(MAX_HISTORY_MESSAGE_CHARS);
        expect(truncate(exactMessage)).toBe(exactMessage);
        expect(truncate(exactMessage).length).toBe(MAX_HISTORY_MESSAGE_CHARS);
    });

    it("should truncate messages longer than MAX_HISTORY_MESSAGE_CHARS", () => {
        const longMessage = "a".repeat(MAX_HISTORY_MESSAGE_CHARS + 100);
        const truncated = truncate(longMessage);

        expect(truncated.length).toBe(MAX_HISTORY_MESSAGE_CHARS + 3); // +3 for "..."
        expect(truncated.endsWith("...")).toBe(true);
    });

    it("should truncate very long messages correctly", () => {
        const veryLongMessage = "x".repeat(50000); // 50,000 chars
        const truncated = truncate(veryLongMessage);

        expect(truncated.length).toBe(MAX_HISTORY_MESSAGE_CHARS + 3);
        expect(truncated.startsWith("x".repeat(100))).toBe(true);
        expect(truncated.endsWith("...")).toBe(true);
    });

    it("should preserve content up to the limit", () => {
        const message = "Hello World! " + "a".repeat(MAX_HISTORY_MESSAGE_CHARS);
        const truncated = truncate(message);

        expect(truncated.startsWith("Hello World!")).toBe(true);
        expect(truncated.length).toBe(MAX_HISTORY_MESSAGE_CHARS + 3);
    });

    it("should handle empty strings", () => {
        expect(truncate("")).toBe("");
    });

    it("should handle single character strings", () => {
        expect(truncate("x")).toBe("x");
    });
});

describe("History Size Limits", () => {
    it("should have MAX_HISTORY_MESSAGE_CHARS at expected value", () => {
        expect(MAX_HISTORY_MESSAGE_CHARS).toBe(500);
    });

    it("maximum history size should be bounded", () => {
        // 6 messages * MAX_HISTORY_MESSAGE_CHARS + 6 * 3 (for "..." if all truncated)
        const maxHistoryChars = 6 * (MAX_HISTORY_MESSAGE_CHARS + 3);
        expect(maxHistoryChars).toBe(3018); // 6 * 503
    });
});
