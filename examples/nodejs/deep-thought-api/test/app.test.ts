import { describe, it, expect } from "vitest";
import { createApp } from "../src/app";

describe("Deep Thought API", () => {
    // Mock config
    const config = {
        resourceWalletAddress: "mock-wallet-address",
        facilitatorUrl: "https://mock-facilitator.com",
    };

    const app = createApp(config);

    it("should return 200 OK for health check", async () => {
        const res = await app.request("/health");
        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data).toHaveProperty("status", "operational");
    });

    it("should return 402 Payment Required for /answer", async () => {
        const res = await app.request("/answer");
        expect(res.status).toBe(402);

        const paymentHeader = res.headers.get("Payment-Required");
        expect(paymentHeader).toBeTruthy();
    });

    it("should return 200 OK for root endpoint", async () => {
        const res = await app.request("/");
        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data).toHaveProperty("name", "Deep Thought API");
    });

    /**
     * ℹ️ PAYMENT VERIFICATION TESTS
     * 
     * You might be wondering: "Where is the test for a successful payment?"
     * 
     * To test the full flow (Client -> Middleware -> Facilitator -> Blockchain), we would need to:
     * 1. Mock the Facilitator's response (so we don't need real crypto).
     * 2. Mock a valid signed payment token.
     * 
     * Since the actual verification logic is handled entirely by the @x402/hono library
     * (which has its own test suite), we don't need to re-test it here.
     * 
     * In a real production app, you might inject a mock FacilitatorClient into 
     * `createApp()` to simulate successful payments during testing.
     * 
     * Example pseudo-code for that advanced setup:
     * 
     * it("should allow access with valid payment", async () => {
     *   const mockFacilitator = new MockFacilitatorClient({ alwaysApprove: true });
     *   const app = createApp(config, mockFacilitator); // Dependency Injection
     *   
     *   const res = await app.request("/answer", {
     *     headers: { "Authorization": "402 <mock_token>" }
     *   });
     *   
     *   expect(res.status).toBe(200);
     *   expect(await res.json()).toHaveProperty("answer", 42);
     * });
     */
});
