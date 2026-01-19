import { describe, it, expect, beforeAll, beforeEach, mock } from "bun:test";
import { createApp } from "../src/app.js";

// Mocks configuration in module scope
// Stateful mock for StateManager
// We use a Map to simulate the DB in-memory so we can test state persistence
// within a single test run without hitting disk / SQLite.
const mockStore = new Map();
const mockBalances = new Map<string, bigint>();

mock.module("../src/lib/state", () => ({
    createStateManager: () => ({
        get: (id: string) => {
            if (mockStore.has(id)) {
                return mockStore.get(id);
            }
            // Default mock behavior if not in store (for existing tests)
            // But strict enough to not return data across different IDs if we didn't put it there
            if (id.includes("new-session")) return null;
            return {
                id,
                context_state: "mock state",
                history: [{ role: 'user', content: 'prev' }],
                main_goal: "Learn Physics",
                updated_at: "now"
            };
        },
        save: (id: string, context_state: string, history: any[], main_goal: string) => {
            mockStore.set(id, {
                id,
                context_state,
                history,
                main_goal,
                updated_at: new Date().toISOString()
            });
        },
        prune: () => 0,
        getBalance: (walletAddress: string) => {
            // Return stored balance or default to rich (1000000n) for tests to pass
            return mockBalances.get(walletAddress) ?? 1000000n;
        },
        adjustBalance: (walletAddress: string, delta: bigint) => {
            const current = mockBalances.get(walletAddress) ?? 1000000n;
            mockBalances.set(walletAddress, current + delta);
        },
        deductBalance: (walletAddress: string, amount: bigint) => {
            const current = mockBalances.get(walletAddress) ?? 1000000n;
            if (current >= amount) {
                mockBalances.set(walletAddress, current - amount);
                return true;
            }
            return false;
        },
        getPayment: () => null,
        recordPayment: () => { }
    }),
}));

mock.module("../src/lib/ai", () => ({
    generateSocraticResponse: async () => {
        // We throw if global flag set (we can't easily access closure variable from here if module is hoisted differently, but bun mock usually works)
        // We'll trust the variable scope works or use a simpler approach
        return {
            reply: "Mock Socratic Answer",
            context_state: "New State",
            main_goal: "Learn Physics Updated"
        };
    },
}));

// Mock @x402/hono
mock.module("@x402/hono", () => {
    return {
        paymentMiddleware: (options: any, server: any) => {
            return async (c: any, next: any) => {
                const auth = c.req.header("Authorization");
                // Allow Bearer or 402 scheme
                const token = auth ? auth.replace(/^(Bearer|402)\s+/, "") : null;

                if (!token || token === "invalid_token") {
                    // Simulate 402 response
                    const routeConfig = options["POST /ask"];
                    if (routeConfig && routeConfig.accepts) {
                        return c.json({ accepts: routeConfig.accepts }, 402);
                    }
                    return c.json({ error: "Payment Required" }, 402);
                }

                // If valid, proceed
                return await next(); // Returning result of next() is CRITICAL for Hono
            };
        },
        x402ResourceServer: class {
            constructor(client: any) { }
            register() { return this; }
            async verifyPayment(payload: any, requirements: any) {
                // Mock verification - always succeeds for testing
                return { isValid: true };
            }
        },
        HonoAdapter: class {
            constructor(public c: any) { }
            getHeader(name: string) { return this.c.req.header(name); }
        },
        x402HTTPResourceServer: class {
            constructor(public server: any, public config: any) { }
            async initialize() { }
            async processHTTPRequest(ctx: any) {
                const auth = ctx.paymentHeader || ctx.adapter.getHeader("Authorization");
                // Simple mock logic matching previous middleware mock
                const token = auth ? auth.replace(/^(Bearer|402)\s+/, "") : null;

                if (!token || token === "invalid_token") {
                    // Return payment options from config in 402 response
                    const routeConfig = this.config["POST /ask"];
                    return {
                        type: "payment-error",
                        response: {
                            status: 402,
                            headers: {},
                            body: { accepts: routeConfig?.accepts || [] }
                        }
                    };
                }

                // Extract wallet from token for testing (simulating real x402 behavior)
                // Use "wallet_" prefix to simulate different wallets
                const walletAddress = token.startsWith("wallet_")
                    ? token.replace("wallet_", "0x")
                    : "0xTestUser";

                return {
                    type: "payment-verified",
                    paymentPayload: {
                        payload: {
                            authorization: {
                                from: walletAddress
                            }
                        }
                    },
                    paymentRequirements: {}
                };
            }
            async processSettlement() { return { success: true, headers: {} }; }
        }
    };
});

mock.module("@x402/core/server", () => ({
    HTTPFacilitatorClient: class {
        async getSupported() { return { kinds: [{ network: "eip155:324705682", extra: { decimals: 6, name: "USDC", version: "1" } }] }; }
    }
}));

mock.module("@x402/core/utils", () => ({
    safeBase64Decode: (str: string) => JSON.stringify({ token: "mock", from: "0xTestUser" }),
    safeBase64Encode: (str: string) => str
}));

// Mock @x402/core/http for decodePaymentSignatureHeader
mock.module("@x402/core/http", () => ({
    encodePaymentRequiredHeader: (pr: any) => JSON.stringify(pr),
    decodePaymentRequiredHeader: (str: string) => JSON.parse(str),
    decodePaymentSignatureHeader: (header: string) => {
        // Parse the header to extract wallet info for testing
        // Reject invalid tokens
        if (header === "invalid_token") {
            throw new Error("Invalid payment signature");
        }

        // In tests, we pass wallet tokens directly, not base64 encoded
        // Try to extract wallet from the header
        if (header.startsWith("wallet_")) {
            const walletAddress = "0x" + header.replace("wallet_", "");
            return {
                x402Version: 2,
                payload: {
                    authorization: {
                        from: walletAddress,
                        value: 1000000 // Default test amount (1 USDC)
                    },
                    signature: "0xtest_signature"
                },
                accepted: {
                    scheme: "exact",
                    network: "eip155:324705682",
                    amount: "1000000",
                    asset: "0xUSDC",
                    payTo: "0x123"
                }
            };
        }
        // For other tokens, return a default test payload
        return {
            x402Version: 2,
            payload: {
                authorization: {
                    from: "0xTestUser",
                    value: 1000000
                },
                signature: "0xtest_signature"
            },
            accepted: {
                scheme: "exact",
                network: "eip155:324705682",
                amount: "1000000",
                asset: "0xUSDC",
                payTo: "0x123"
            }
        };
    }
}));

describe("Socratic Mentor API Integration", () => {
    const config = {
        skaleWalletAddress: "0x123",
        skaleNetworkId: "eip155:324705682",
        skaleAssetAddress: "0xUSDC",
        facilitatorUrl: "https://mock.com",
        googleApiKey: "mock-key",
    };

    let app: any;

    beforeEach(() => {
        mockStore.clear();
        mockBalances.clear();
    });

    beforeAll(async () => {
        const result = await createApp(config);
        app = result.app;
    });

    it("should return health check", async () => {
        const res = await app.request("/health");
        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({ status: "operational" });
    });

    it("should return 402 for paid endpoint without payment", async () => {
        const res = await app.request("/ask", {
            method: "POST",
            body: JSON.stringify({ message: "Hello" }),
            headers: { "Content-Type": "application/json" }
        });

        expect(res.status).toBe(402);
        const data = await res.json();
        expect(data.accepts).toBeDefined();
        expect(data.accepts.length).toBeGreaterThan(0);

        // Verify x402-balance extension is present
        expect(data.extensions).toBeDefined();
        expect(data.extensions["x402-balance"]).toBeDefined();
        expect(data.extensions["x402-balance"].info.supportsTopup).toBe(true);
        expect(data.extensions["x402-balance"].info.supportsBalance).toBe(true);
        expect(data.extensions["x402-balance"].info.identityMechanism).toBe("previous-proof");
        expect(data.extensions["x402-balance"].schema).toBeDefined();
    });

    it("should return 400 for invalid input (missing message)", async () => {
        const res = await app.request("/ask", {
            method: "POST",
            body: JSON.stringify({ main_goal: "Just a goal" }),
            headers: { "Content-Type": "application/json" }
        });
        expect(res.status).toBe(400);
        const data = await res.json();
        expect(data.error).toBe("Invalid Input");
    });

    it("should process request with valid mock payment and return session_id", async () => {
        const res = await app.request("/ask", {
            method: "POST",
            body: JSON.stringify({ message: "Hello" }),
            headers: {
                "Content-Type": "application/json",
                // "valid_mock_token" is considered valid by our mock
                "PAYMENT-SIGNATURE": "valid_mock_token"
            }
        });

        if (res.status !== 200) {
            const d = await res.json();
            console.log("Unexpected error response:", JSON.stringify(d, null, 2));
        }

        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.reply).toBe("Mock Socratic Answer");
        expect(data.session_id).toBeDefined();
    });

    it("should return 400 for invalid session_id format", async () => {
        const res = await app.request("/ask", {
            method: "POST",
            body: JSON.stringify({
                message: "Hello",
                session_id: "not-a-uuid"
            }),
            headers: { "Content-Type": "application/json" }
        });
        expect(res.status).toBe(400);
        const data = await res.json();
        expect(data.error).toBe("Invalid Input");
        expect(data.details).toBeDefined();
        // Verify that the validation error is for session_id
        expect(data.details.some((d: any) => d.path === "session_id")).toBe(true);
    });

    it("should return 402 if payment verification fails (invalid token)", async () => {
        const res = await app.request("/ask", {
            method: "POST",
            body: JSON.stringify({ message: "Hello" }),
            headers: {
                "Content-Type": "application/json",
                "PAYMENT-SIGNATURE": "invalid_token"
            }
        });
        expect(res.status).toBe(402);
        const data = await res.json();
        expect(data.accepts).toBeDefined();
    });

    it("should accept existing session_id", async () => {
        const res = await app.request("/ask", {
            method: "POST",
            body: JSON.stringify({
                message: "Hello again",
                session_id: "019468c8-b184-7299-80bf-104997327771",
            }),
            headers: {
                "Content-Type": "application/json",
                "PAYMENT-SIGNATURE": "valid_mock_token"
            }
        });

        expect(res.status).toBe(200);
        const data = await res.json();
        // The API should respect the client's session choice
        expect(data.session_id).toBe("019468c8-b184-7299-80bf-104997327771");
    });

    it("should extract wallet from payment payload", async () => {
        // Use wallet_ prefix which our mock converts to 0x prefix
        const res = await app.request("/ask", {
            method: "POST",
            body: JSON.stringify({ message: "Test message" }),
            headers: {
                "Content-Type": "application/json",
                "PAYMENT-SIGNATURE": "wallet_abc123"
            }
        });

        // Request should succeed (wallet extracted from paymentPayload)
        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.reply).toBeDefined();
        expect(data.session_id).toBeDefined();
    });

    it("should generate new session_id when not provided", async () => {
        const res = await app.request("/ask", {
            method: "POST",
            body: JSON.stringify({ message: "First message" }),
            headers: {
                "Content-Type": "application/json",
                "PAYMENT-SIGNATURE": "valid_mock_token"
            }
        });

        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.session_id).toBeDefined();
        // UUID v7 format validation
        expect(data.session_id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    });

    it("should return consistent session_id when provided", async () => {
        const providedSessionId = "019468c8-b184-7299-80bf-104997327771";

        const res = await app.request("/ask", {
            method: "POST",
            body: JSON.stringify({
                message: "Follow-up message",
                session_id: providedSessionId
            }),
            headers: {
                "Content-Type": "application/json",
                "PAYMENT-SIGNATURE": "valid_mock_token"
            }
        });

        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.session_id).toBe(providedSessionId);
    });

    it("should isolate separate contexts for different wallets sharing same session_id", async () => {
        // This is the CRITICAL security test
        // Scenario: Two users happen to use the same UUID (maliciously or accidentally).
        // Since session_id is provided by the client, we cannot trust it to be globally unique.
        // We MUST scope sessions by Wallet Address (Identity) to prevent data leaks.
        // Expected: Two users with same session_id have completely separate history/context.
        const sameSessionId = "019468c8-b184-7299-80bf-104997327771";

        // User A (Alice)
        const resAlice = await app.request("/ask", {
            method: "POST",
            body: JSON.stringify({ message: "My name is Alice", session_id: sameSessionId }),
            headers: {
                "Content-Type": "application/json",
                // Mock will extract wallet: 0xAlice
                "PAYMENT-SIGNATURE": "wallet_Alice"
            }
        });
        expect(resAlice.status).toBe(200);

        // User B (Bob) using SAME session ID
        const resBob = await app.request("/ask", {
            method: "POST",
            body: JSON.stringify({ message: "My name is Bob", session_id: sameSessionId }),
            headers: {
                "Content-Type": "application/json",
                // Mock will extract wallet: 0xBob
                "PAYMENT-SIGNATURE": "wallet_Bob"
            }
        });
        expect(resBob.status).toBe(200);

        // Verify storage isolation in our mock store
        // Keys should be {wallet}:{session_id}
        const aliceKey = `0xAlice:${sameSessionId}`;
        const bobKey = `0xBob:${sameSessionId}`;

        expect(mockStore.has(aliceKey)).toBe(true);
        expect(mockStore.has(bobKey)).toBe(true);

        // Also verify they are distinct entries
        const aliceState = mockStore.get(aliceKey);
        const bobState = mockStore.get(bobKey);

        // They should not be the same reference
        expect(aliceState).not.toBe(bobState);

        // In a real scenario, the history would differ because inputs differed
        // Our mock AI returns static response, but the saved history includes user input
        // Let's verify Alice's input is in Alice's state
        const aliceHistory = aliceState.history;
        const bobHistory = bobState.history;

        // Check finding the specific user message in history
        const aliceMsgFound = aliceHistory.some((h: any) => h.content.includes("Alice"));
        const bobMsgFound = bobHistory.some((h: any) => h.content.includes("Bob"));

        expect(aliceMsgFound).toBe(true);
        expect(bobMsgFound).toBe(true);

        // And crucially: Alice's state should NOT contain Bob's message
        const bobInAlice = aliceHistory.some((h: any) => h.content.includes("Bob"));
        expect(bobInAlice).toBe(false);
    });
});
