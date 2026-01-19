import { describe, it, expect, beforeAll, beforeEach, mock } from "bun:test";
import { createApp } from "../src/app.js";

// Mock Data Stores
const mockSessions = new Map();
const mockBalances = new Map<string, bigint>();
const mockPayments = new Map<string, string>(); // hash -> wallet

mock.module("../src/lib/state", () => ({
    createStateManager: () => ({
        get: (id: string) => mockSessions.get(id) || null,
        save: (id: string, context_state: string, history: any[], main_goal: string) => {
            mockSessions.set(id, { id, context_state, history, main_goal });
        },
        prune: () => 0,
        // Ledger Methods
        // Ledger Methods
        getBalance: (wallet: string) => mockBalances.get(wallet) || 0n,
        adjustBalance: (wallet: string, delta: bigint) => {
            const current = mockBalances.get(wallet) || 0n;
            mockBalances.set(wallet, current + delta);
        },
        deductBalance: (wallet: string, amount: bigint) => {
            if (wallet === "0xRaceFail") return false; // Trigger Race Failure
            const current = mockBalances.get(wallet) || 0n;
            if (current >= amount) {
                mockBalances.set(wallet, current - amount);
                return true;
            }
            return false;
        },
        getPayment: (hash: string) => {
            const w = mockPayments.get(hash);
            return w ? { wallet_address: w } : null;
        },
        recordPayment: (hash: string, wallet: string) => mockPayments.set(hash, wallet)
    }),
}));

mock.module("../src/lib/ai", () => ({
    generateSocraticResponse: async () => ({
        reply: "Mock Answer",
        context_state: "New State",
        main_goal: "Goal"
    }),
}));

// Mock pricing to have deterministic costs
// We'll trust the real pricing logic but Mock what we assume the costs are
// OR we can rely on the real pricing since it's imported.
// We'll import real constants to assert correctly.
import { calculatePrice, priceToAtomicUnits } from "../src/lib/pricing.js";

// Mock @x402/core/http for decodePaymentSignatureHeader (V2 payloads)
mock.module("@x402/core/http", () => ({
    encodePaymentRequiredHeader: (pr: any) => JSON.stringify(pr),
    decodePaymentRequiredHeader: (str: string) => JSON.parse(str),
    decodePaymentSignatureHeader: (header: string) => {
        // Decode base64 encoded JSON from test headers
        let json: any = {};
        try {
            json = JSON.parse(atob(header));
        } catch (e) {
            // Invalid token
        }

        // Return V2-compliant payload structure
        return {
            x402Version: 2,
            payload: {
                authorization: {
                    from: json.from || "0xUser",
                    value: json.amount || "0",
                    proof: json.proof // For processSettlement mock
                },
                signature: json.proof // For ask.ts signatureHash extraction
            },
            accepted: {
                scheme: "exact",
                network: "skale",
                amount: json.amount || "0",
                asset: "0xUSDC"
            }
        };
    }
}));

mock.module("@x402/hono", () => ({
    x402HTTPResourceServer: class {
        constructor(public server: any, public config: any) { }
        async initialize() { }
        async processHTTPRequest(ctx: any) {
            const auth = ctx.paymentHeader;
            if (!auth) return { type: "payment-error", response: { status: 402, headers: {}, body: {} } };

            // Allow bypassing mock check with specific token
            if (auth.includes("invalid")) return { type: "payment-error", response: { status: 402, headers: {}, body: {} } };

            // Simulate x402 decoding
            // Expect "x402 <base64>"
            // For tests, we'll put JSON in base64
            let payload: any = {};
            try {
                const token = auth.split(" ")[1];
                payload = JSON.parse(atob(token));
            } catch (e) { }

            // If proof starts with "new", it's a NEW payment logic
            // If proof starts with "old", logic assumes it wouldn't reach here if it was in ledger (unless we test fallthrough)

            const amount = payload.amount || "0";
            const wallet = payload.from || "0xUser";
            const proof = payload.proof || "proof";

            return {
                type: "payment-verified",
                paymentPayload: {
                    payload: {
                        authorization: {
                            from: wallet,
                            amount: amount,
                            proof: proof
                        }
                    }
                },
                paymentRequirements: {}
            };
        }
        async processSettlement(payload: any) {
            // START EDIT: Trigger Settlement Failure
            if (payload?.payload?.authorization?.proof === "fail_sig") {
                return { success: false };
            }
            // END EDIT
            return { success: true };
        }
    },
    x402ResourceServer: class {
        register() { return this; }
        async verifyPayment(payload: any, requirements: any) {
            // Always succeed for test purposes
            return { isValid: true };
        }
    },
    HonoAdapter: class { }
}));

mock.module("@x402/core/server", () => ({
    HTTPFacilitatorClient: class {
        async getSupported() { return { kinds: [{ network: "skale", extra: { decimals: 6, name: "USDC", version: "1" } }] }; }
    }
}));

describe("Mini-Ledger & Balance Logic", () => {
    let app: any;

    // Helper to create V2 payment token (base64 encoded JSON)
    const createPaymentToken = (proof: string, amount: string, from: string = "0xUser") => {
        const json = JSON.stringify({ proof, amount, from });
        return btoa(json);
    };

    // Helper to create Authorization header for identity (signature lookup)
    const createAuthHeader = (proof: string, amount: string, from: string = "0xUser") => {
        return `x402 ${createPaymentToken(proof, amount, from)}`;
    };

    beforeAll(async () => {
        const result = await createApp({
            facilitatorUrl: "http://mock",
            skaleWalletAddress: "0xSvc",
            skaleNetworkId: "skale",
            skaleAssetAddress: "0xUSDC"
        });
        app = result.app;
    });

    beforeEach(() => {
        mockBalances.clear();
        mockPayments.clear();
        mockSessions.clear();
    });

    it("Scenario 1: Identity (Ledger Hit) - Succcessful Service with Balance", async () => {
        // Setup: User has balance and is known
        const wallet = "0xRichUser";
        const proof = "old_signature";
        mockBalances.set(wallet, 1000000n); // Plenty of balance
        mockPayments.set(proof, wallet);

        // Calculate expected cost for "Hello"
        // roughly: (5 len + 0 context) * price + base
        // We'll just verify balance went down.

        const res = await app.request("/ask", {
            method: "POST",
            body: JSON.stringify({ message: "Hello" }),
            headers: {
                Authorization: createAuthHeader(proof, "0", wallet),
                "PAYMENT-SIGNATURE": createPaymentToken(proof, "0", wallet)
            }
        });

        expect(res.status).toBe(200);

        // Assert Balance Deducted
        const newBalance = mockBalances.get(wallet)!;
        expect(newBalance).toBeLessThan(1000000n);
        expect(newBalance).toBeGreaterThan(0n);

        // Verify Header
        const headerBalance = res.headers.get("X-Balance-Remaining");
        expect(headerBalance).toBe(newBalance.toString());
    });

    it("Scenario 2: New Payment (Facilitator Hit) - Credits Balance", async () => {
        const wallet = "0xNewUser";
        const proof = "new_signature";
        const paymentAmount = "1000000"; // 1 USDC

        // Ledger Empty

        const res = await app.request("/ask", {
            method: "POST",
            body: JSON.stringify({ message: "Hello" }),
            headers: { "PAYMENT-SIGNATURE": createPaymentToken(proof, paymentAmount, wallet) }
        });

        expect(res.status).toBe(200);

        // Assert Payment Recorded
        expect(mockPayments.get(proof)).toBe(wallet);

        // Assert Balance = Amount - Cost
        // But since settlement is ASYNC, the response header might show OLD balance (0).

        // Verify Header (Immediate) structure
        const headerBalance = res.headers.get("X-Balance-Remaining");
        expect(headerBalance).toBe("0"); // 0 because settlement hasn't credited yet

        // Wait for Async Settlement
        await new Promise(r => setTimeout(r, 20));

        const balance = mockBalances.get(wallet)!;
        // Cost is definitely > 0 and < 1000000
        expect(balance).toBeLessThan(BigInt(paymentAmount));
        expect(balance).toBeGreaterThan(0n);
    });

    it("Scenario 3: Insufficient Funds - Returns 402 with Deficit", async () => {
        const wallet = "0xPoorUser";
        const proof = "old_sig";
        mockBalances.set(wallet, 10n); // Tiny balance
        mockPayments.set(proof, wallet);

        const res = await app.request("/ask", {
            method: "POST",
            body: JSON.stringify({ message: "Long message logic check" }),
            headers: {
                Authorization: createAuthHeader(proof, "0", wallet),
                "PAYMENT-SIGNATURE": createPaymentToken(proof, "0", wallet)
            }
        });

        expect(res.status).toBe(402);
        const data = await res.json();

        expect(data.error).toBe("Insufficient Balance");
        expect(data.accepts[0].amount).toBeDefined();
        // Check deficit is calculated (Cost - 10)
        // We can't easily know exact cost but it should be > 0
        expect(BigInt(data.accepts[0].amount)).toBeGreaterThan(0n);
    });

    it("Scenario 4: Bait-and-Switch - Payment provided < Actual Cost", async () => {
        // User sends a "New Payment" of 100 units
        // But sends a message that costs 500 units

        const wallet = "0xCheater";
        const proof = "fresh_sig";
        const paymentAmount = "100"; // Very low

        // We need a message that costs MORE than 100
        // Base cost is already defined in pricing.ts. Let's send a long message.
        const longMessage = "A".repeat(1000);

        const res = await app.request("/ask", {
            method: "POST",
            body: JSON.stringify({ message: longMessage }),
            headers: { "PAYMENT-SIGNATURE": createPaymentToken(proof, paymentAmount, wallet) }
        });

        expect(res.status).toBe(402);
        const data = await res.json();

        expect(data.error).toBe("Insufficient Balance");
    });

    it("Scenario 5: Split Payment - Balance + New Payment >= Cost", async () => {
        const wallet = "0xSplitUser";
        const proof = "partial_sig";

        // Has some balance, but not enough for full request
        // Let's say cost is ~5000 (just guessing base cost is high)
        // Let's give balance 1
        mockBalances.set(wallet, 1n);

        // Send payment of 1000000 (plenty)
        const paymentAmount = "1000000";

        const res = await app.request("/ask", {
            method: "POST",
            body: JSON.stringify({ message: "Hello" }),
            headers: { "PAYMENT-SIGNATURE": createPaymentToken(proof, paymentAmount, wallet) }
        });

        expect(res.status).toBe(200);

        // Balance should be: 1 + 1000000 - Cost
        const balance = mockBalances.get(wallet)!;
        expect(balance).toBeLessThan(1000001n);
        // Should be roughly 1000000
    });
    it("Scenario 6: Client Isolation - Balances are distinct", async () => {
        const alice = "0xAlice";
        const bob = "0xBob";
        const aliceProof = "alice_sig";

        // Setup: Alice has 1000, Bob has 1000
        mockBalances.set(alice, 1000n);
        mockBalances.set(bob, 1000n);
        mockPayments.set(aliceProof, alice);

        // Alice makes a request (Costs ~985)
        // She has enough balance (1000 > 985 is false, wait. 1000 atomic units is $0.001)
        // Price is roughly 1000. Let's give them plenty.
        // Price is ~985 atomic units for "Hello".
        // Let's give them 2000.
        mockBalances.set(alice, 2000n);
        mockBalances.set(bob, 2000n);

        const res = await app.request("/ask", {
            method: "POST",
            body: JSON.stringify({ message: "Hello" }),
            headers: {
                Authorization: createAuthHeader(aliceProof, "0", alice),
                "PAYMENT-SIGNATURE": createPaymentToken(aliceProof, "0", alice)
            }
        });

        expect(res.status).toBe(200);

        // Alice's balance should decrease
        const aliceBalance = mockBalances.get(alice)!;
        expect(aliceBalance).toBeLessThan(2000n);

        // Bob's balance should be UNTOUCHED
        const bobBalance = mockBalances.get(bob)!;
        expect(bobBalance).toBe(2000n);
    });

    it("Scenario 7: Settlement Failure - Service Rendered (Optimistic), but Balance NOT Credited", async () => {
        const wallet = "0xSettlementFail";
        // Use a proof that triggers the mock failure
        const proof = "fail_sig";
        const paymentAmount = "1000000";

        // Ledger Empty for this wallet

        const res = await app.request("/ask", {
            method: "POST",
            body: JSON.stringify({ message: "Hello" }),
            headers: { "PAYMENT-SIGNATURE": createPaymentToken(proof, paymentAmount, wallet) }
        });

        // Current implementation: Optimistic Service.
        // So we expect 200 OK.
        // But settlement fails in background.
        // Balance should NOT be credited.

        expect(res.status).toBe(200);

        // Wait a tiny bit for async settlement callback to possibly run (and fail)
        await new Promise(r => setTimeout(r, 10));

        // Assert Payment NOT Recorded
        // (Wait, do we record if failed? No.)
        expect(mockPayments.has(proof)).toBe(false);

        // Assert Balance NOT Credited
        const balance = mockBalances.get(wallet) || 0n;
        expect(balance).toBe(0n);
    });

    it("Scenario 8: Reservation Failure (Race Condition) - Returns 402", async () => {
        // Trigger race failure via specific wallet "0xRaceFail"
        const wallet = "0xRaceFail";
        const proof = "race_sig";
        // Give them plenty of balance so they PASS the Deficit check
        mockBalances.set(wallet, 1000000n);
        mockPayments.set(proof, wallet);

        // Request
        const res = await app.request("/ask", {
            method: "POST",
            body: JSON.stringify({ message: "Hello" }),
            headers: {
                Authorization: createAuthHeader(proof, "0", wallet),
                "PAYMENT-SIGNATURE": createPaymentToken(proof, "0", wallet)
            }
        });

        // Even though they have 1M balance, the mock `deductBalance` returns false for "0xRaceFail".
        // This simulates a race condition where another request stole the funds right before this one.
        // Expect 402.

        expect(res.status).toBe(402);
    });
});
