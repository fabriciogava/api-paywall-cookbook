import { Hono } from "hono";
import { v7 } from "uuid";
import { z } from "zod";
import { x402ResourceServer, x402HTTPResourceServer, HonoAdapter } from "@x402/hono";
import { StateManager } from "../lib/state.js";
import { calculatePrice, priceToAtomicUnits, formatPrice, MAX_HISTORY_MESSAGE_CHARS } from "../lib/pricing.js";
import { generateSocraticResponse } from "../lib/ai.js";
import { AppConfig } from "../app.js";

/**
 * Creates the /ask route with all dependencies injected.
 * Uses manual payment verification with async settlement for faster response times.
 */
export function createAskRoute(
    config: AppConfig,
    stateManager: StateManager,
    resourceServer: x402ResourceServer,
    assetMetadata: { decimals: number; name: string; version: string }
) {
    const app = new Hono();

    // Define payment-protected route config
    const getPaymentOptions = (priceAtomic: string, priceFormatted: string) => [{
        scheme: "exact" as const,
        price: {
            amount: priceAtomic,
            asset: config.skaleAssetAddress || "0xUSDC",
            extra: {
                name: assetMetadata.name,
                version: assetMetadata.version
            }
        },
        network: config.skaleNetworkId as any,
        asset: config.skaleAssetAddress || "0xUSDC",
        payTo: config.skaleWalletAddress as string,
        maxTimeoutSeconds: 300,
        description: `Socratic Consultation (${priceFormatted})`
    }];

    app.post("/", async (c) => {
        console.log(`[${new Date().toISOString()}] [Ask] Received request`);

        // A. Parse Body & Calculate Price
        let body;
        try {
            body = await c.req.json();
        } catch (e) {
            return c.json({ error: "Invalid JSON body" }, 400);
        }

        const inputSchema = z.object({
            message: z.string(),
            session_id: z.string().optional(),
            main_goal: z.string().optional()
        });

        const parsed = inputSchema.safeParse(body);
        if (!parsed.success) {
            if (body && !body.message && body.main_goal) return c.json({ error: "Invalid Input" }, 400);
            return c.json({ error: "Invalid Input" }, 400);
        }

        const { message, session_id, main_goal } = parsed.data;

        if (session_id && !z.string().uuid().safeParse(session_id).success) {
            return c.json({ error: "Invalid session_id format" }, 400);
        }

        // B. Pricing Logic
        // Note: For pricing, we can't identify the user yet (wallet is in paymentPayload after verification)
        // Uses DEFAULT_PRICING_CONFIG from pricing.ts (adjust constants there to change pricing)
        let state = { history: [] as Array<{ role: 'user' | 'model', content: string }>, main_goal: main_goal || "General Socratic Inquiry", context_state: "" };

        const price = calculatePrice(message); // Uses DEFAULT_PRICING_CONFIG
        const priceAtomic = priceToAtomicUnits(price, assetMetadata.decimals);
        const priceFormatted = formatPrice(price);
        console.log(`[${new Date().toISOString()}] [Ask] Price calculated: ${priceFormatted} (${priceAtomic} atomic units)`);
        const paymentOptions = getPaymentOptions(priceAtomic, priceFormatted);

        // C. Create HTTP Resource Server for manual verification
        const httpServer = new x402HTTPResourceServer(resourceServer, {
            "POST /ask": {
                accepts: paymentOptions,
                description: "Socratic Consultation",
                mimeType: "application/json"
            }
        });
        await httpServer.initialize();

        // D. Manually verify payment
        const adapter = new HonoAdapter(c);
        const result = await httpServer.processHTTPRequest({
            adapter,
            path: "/ask",
            method: "POST",
            paymentHeader: c.req.header("Authorization")
        });

        // Handle non-payment or payment error cases
        if (result.type === "no-payment-required") {
            // This endpoint requires payment, shouldn't happen
            return c.json({ error: "Unexpected state" }, 500);
        }

        if (result.type === "payment-error") {
            // Set headers from the response (required for client SDK compatibility)
            const { response } = result;
            Object.entries(response.headers).forEach(([key, value]) => {
                c.header(key, value);
            });
            // Return 402 with payment options
            return c.json(response.body, response.status as any);
        }

        // Payment verified! Now process AI response
        console.log(`[${new Date().toISOString()}] [Ask] Payment Verified. Processing AI Response...`);
        const { paymentPayload, paymentRequirements } = result;

        // Extract wallet address from payment payload
        const walletAddress = (paymentPayload as any)?.payload?.authorization?.from || "anonymous";
        console.log(`[${new Date().toISOString()}] [Ask] Wallet: ${walletAddress}`);

        let currentSessionId = session_id || v7();

        // Now load context with proper wallet:session key
        if (session_id) {
            const contextKey = `${walletAddress}:${session_id}`;
            console.log(`[${new Date().toISOString()}] [Ask] Loading context for key: ${contextKey}`);
            const loaded = stateManager.get(contextKey);
            if (loaded) {
                state = loaded as any;
                console.log(`[${new Date().toISOString()}] [Ask] Context loaded. History length: ${state.history?.length || 0}, Context: ${state.context_state?.substring(0, 50) || '(empty)'}`);
            } else {
                console.log(`[${new Date().toISOString()}] [Ask] No context found for key.`);
            }
        } else {
            console.log(`[${new Date().toISOString()}] [Ask] No session_id provided, starting fresh context.`);
        }

        try {
            const aiResponse = await generateSocraticResponse(
                message,
                state.history || [],
                state.context_state || "",
                state.main_goal || main_goal || "",
                config.googleApiKey
            );

            const newMainGoal = aiResponse.main_goal || state.main_goal || main_goal;

            // Truncate messages to prevent large history from causing unprofitable carry-forward
            const truncate = (text: string) =>
                text.length > MAX_HISTORY_MESSAGE_CHARS
                    ? text.slice(0, MAX_HISTORY_MESSAGE_CHARS) + "..."
                    : text;

            const newHistory = [
                ...(state.history || []),
                { role: "user" as const, content: truncate(message) },
                { role: "model" as const, content: truncate(aiResponse.reply) }
            ].slice(-6);

            const contextKey = `${walletAddress}:${currentSessionId}`;
            console.log(`[${new Date().toISOString()}] [Ask] Saving context for key: ${contextKey}, History length: ${newHistory.length}`);

            await stateManager.save(contextKey, aiResponse.context_state, newHistory, newMainGoal);

            console.log(`[${new Date().toISOString()}] [Ask] Payment success. Returning response for session: ${currentSessionId}, wallet: ${walletAddress}`);

            // E. Settle payment ASYNCHRONOUSLY - don't await!
            // This allows the response to return immediately while settlement happens in background
            httpServer.processSettlement(paymentPayload, paymentRequirements)
                .then((settleResult) => {
                    if (!settleResult.success) {
                        console.error(`[${new Date().toISOString()}] [Ask] Settlement failed:`, settleResult.errorReason);
                    } else {
                        console.log(`[${new Date().toISOString()}] [Ask] Settlement completed successfully`);
                    }
                })
                .catch((err) => {
                    console.error(`[${new Date().toISOString()}] [Ask] Settlement error:`, err);
                });

            // Return response immediately - client gets it before settlement completes!
            return c.json({
                reply: aiResponse.reply,
                session_id: currentSessionId
            });

        } catch (e: any) {
            console.error("AI Service Error:", e);
            return c.json({ error: "AI Service Unavailable" }, 500);
        }
    });

    return app;
}
