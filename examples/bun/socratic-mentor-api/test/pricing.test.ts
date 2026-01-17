import { describe, it, expect } from "bun:test";
import {
    calculatePrice,
    priceToAtomicUnits,
    PricingConfig,
    DEFAULT_PRICING_CONFIG,
    MAX_HISTORY_MESSAGE_CHARS
} from "../src/lib/pricing.js";

describe("Pricing Logic", () => {
    const config: PricingConfig = {
        pricePerChar: 0.001,
        baseCost: 0.01,
        estimatedContextChars: 0, // No context estimation for basic test
        minimumPrice: 0 // No minimum for basic tests
    };

    it("should calculate price correctly based on input length", () => {
        // 10 chars + 0 estimated context chars
        // 0.01 + 0.01 = 0.02
        const price = calculatePrice("1234567890", config);
        // expect(price).toBeCloseTo(0.02); // Bun might not have toBeCloseTo in all versions, let's use check
        expect(Math.abs(price - 0.02) < 0.00001).toBe(true);
    });

    it("should include estimated context in calculation", () => {
        // 10 input + 10 estimated context
        // 0.02 + 0.01 = 0.03
        const configWithContext: PricingConfig = { ...config, estimatedContextChars: 10 };
        const price = calculatePrice("1234567890", configWithContext);
        expect(Math.abs(price - 0.03) < 0.00001).toBe(true);
    });

    it("should enforce minimum price floor", () => {
        // Very short input: 2 chars = 0.002 + 0.01 = 0.012
        // But minimum is 0.05, so should return 0.05
        const configWithMinimum: PricingConfig = { ...config, minimumPrice: 0.05 };
        const price = calculatePrice("ab", configWithMinimum);
        expect(price).toBe(0.05);
    });

    it("should not apply minimum if calculated price exceeds it", () => {
        // 100 chars = 0.1 + 0.01 = 0.11, which exceeds minimum of 0.05
        const configWithMinimum: PricingConfig = { ...config, minimumPrice: 0.05 };
        const price = calculatePrice("a".repeat(100), configWithMinimum);
        expect(Math.abs(price - 0.11) < 0.00001).toBe(true);
    });

    it("should convert price to atomic units correctly (USDC 6 decimals)", () => {
        const atomic = priceToAtomicUnits(0.001, 6);
        expect(atomic).toBe("1000");

        const atomic2 = priceToAtomicUnits(1.50, 6);
        expect(atomic2).toBe("1500000");
    });

    it("should handle floating point precision in atomic conversion", () => {
        const atomic = priceToAtomicUnits(0.000001, 6);
        expect(atomic).toBe("1");
    });
});

describe("Default Pricing Config", () => {
    it("should export DEFAULT_PRICING_CONFIG with all required fields", () => {
        expect(DEFAULT_PRICING_CONFIG).toBeDefined();
        expect(typeof DEFAULT_PRICING_CONFIG.pricePerChar).toBe("number");
        expect(typeof DEFAULT_PRICING_CONFIG.baseCost).toBe("number");
        expect(typeof DEFAULT_PRICING_CONFIG.estimatedContextChars).toBe("number");
        expect(typeof DEFAULT_PRICING_CONFIG.minimumPrice).toBe("number");
    });

    it("should have positive base cost accounting for tokens", () => {
        expect(DEFAULT_PRICING_CONFIG.baseCost).toBeGreaterThan(0);
    });

    it("should have minimumPrice set to smallest USDC unit", () => {
        expect(DEFAULT_PRICING_CONFIG.minimumPrice).toBe(0.000001);
    });

    it("should use default config when no config provided", () => {
        const price = calculatePrice("Hello");
        expect(price).toBeGreaterThan(0);
        expect(price).toBeGreaterThanOrEqual(DEFAULT_PRICING_CONFIG.minimumPrice);
    });
});

describe("History Truncation Config", () => {
    it("should export MAX_HISTORY_MESSAGE_CHARS", () => {
        expect(MAX_HISTORY_MESSAGE_CHARS).toBeDefined();
        expect(typeof MAX_HISTORY_MESSAGE_CHARS).toBe("number");
    });

    it("should have MAX_HISTORY_MESSAGE_CHARS set to 500", () => {
        expect(MAX_HISTORY_MESSAGE_CHARS).toBe(500);
    });
});
