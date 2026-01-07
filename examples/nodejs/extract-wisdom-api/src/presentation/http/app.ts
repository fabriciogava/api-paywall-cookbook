import { Hono } from "hono";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";
import { paymentMiddleware, x402ResourceServer, HonoAdapter } from "@x402/hono";
import { Network } from "@x402/core/types";
import { ExactSvmScheme } from "@x402/svm/exact/server";
import { HTTPFacilitatorClient } from "@x402/core/server";
import { declareDiscoveryExtension, bazaarResourceServerExtension } from "@x402/extensions/bazaar";
import { config } from "../../infra/config/index.js";
import { WisdomService } from "../../core/usecases/WisdomService.js";
import { TranscriptNotFoundError, TranscriptEmptyError, InvalidUrlError } from "../../core/entities/Errors.js";
import { validateAndNormalizeYouTubeUrl } from "../../core/validation/UrlValidator.js";
import { YouTubeAdapter } from "../../infra/adapters/YouTubeAdapter.js";
import { GeminiAdapter } from "../../infra/adapters/GeminiAdapter.js";
import { InMemoryStorage } from "../../infra/adapters/InMemoryStorage.js";

// ==========================================
// 1. DEPENDENCY INJECTION (Composition Root)
// ==========================================
// In Clean Architecture, we "inject" the dependencies (adapters) into our core services.
// This makes the code modular and easy to test. For example, we could easily swap 
// VertexAI for OpenAI or YouTubeAdapter for a text file reader without changing the core logic.

// Initialize Adapters (Infrastructure Layer)
// - YouTubeAdapter: Knows how to talk to YouTube.
// - GeminiAdapter: Knows how to talk to Google Gemini (via API Key).
// - InMemoryStorage: A simple cache to store transcripts (avoids fetching the same video twice).
const memoryStorage = new InMemoryStorage();
const youtubeAdapter = new YouTubeAdapter();
const vertexAIAdapter = new GeminiAdapter(config.GOOGLE_API_KEY);

// Initialize Core Service (Application Layer)
// The Service gets the adapters it needs to do its job (Business Logic).
const wisdomService = new WisdomService(youtubeAdapter, vertexAIAdapter, memoryStorage);

// ==========================================
// 2. SETUP X402 FACILITATOR & SERVER
// ==========================================
// This is the magic that enables the paywall. 
// We use the @x402/hono library to integrate with the Hono web framework.

// The Facilitator is the trusted third-party that verifies payments.
// We connect to the public Kobaru facilitator or a self-hosted one to check proofs.
const facilitatorClient = new HTTPFacilitatorClient({
    url: config.FACILITATOR_URL,
});

// The ResourceServer is our gatekeeper. It holds the rules for checking payments.
// We register the "ExactSvmScheme", which means we expect exact payments on the Solana Virtual Machine (SVM).
const resourceServer = new x402ResourceServer(facilitatorClient);
resourceServer.register(config.SOLANA_NETWORK_ID as Network, new ExactSvmScheme());
resourceServer.registerExtension(bazaarResourceServerExtension);

// ==========================================
// 3. WEB SERVER SETUP (Hono)
// ==========================================
const app = new Hono();

// Enable CORS so this API can be called from browsers (e.g. our 007 Agent or a frontend app)
// The wildcard "*" allows any domain to access it. In production, you might restrict this.
// Enable CORS so this API can be called from browsers (e.g. our 007 Agent or a frontend app)
// The wildcard "*" allows any domain to access it. In production, you might restrict this.
app.use("/*", cors());

// LOGGING MIDDLEWARE
app.use("*", async (c, next) => {
    const start = Date.now();
    const { method, url } = c.req;
    console.log(`[INFO] Incoming Request: ${method} ${url}`);

    await next();

    const duration = Date.now() - start;
    console.log(`[INFO] Completed Request: ${method} ${url} - Status: ${c.res.status} - Duration: ${duration}ms`);
});

/**
 * GET /
 * Simple health check and introduction.
 */
app.get("/", (c) => {
    return c.json({
        name: "Wizard's Wisdom API",
        message: "You shall not pass... without paying the x402 fee!",
        usage: "POST /wisdom { url: 'https://youtube.com/...' }"
    });
});

// ==========================================
// 4. DEFINE PAYMENT CONFIGURATION
// ==========================================
// We use a dynamic configuration to calculate price based on video length.
// This object tells the middleware HOW to charge for the endpoint.
const wisdomPaymentConfig = {
    accepts: {
        scheme: "exact" as const, // We want the exact amount
        network: config.SOLANA_NETWORK_ID as Network, // Network (e.g., "solana-devnet")
        asset: config.USDC_ASSET_ADDRESS, // Asset (USDC token address)
        payTo: config.RESOURCE_WALLET_ADDRESS, // Who receives the money (You!)
        maxTimeoutSeconds: 300, // 5 minutes for the user to complete payment
        extra: { // Optional but recommended metadata for the client
            name: "USDC",
            version: "2"
        },
        // DYNAMIC PRICING: Calculate price based on the video URL in the body
        // This function is called by the middleware Interceptor BEFORE the 402 is generated.
        price: async (context: any) => {
            try {
                // Parse body to get URL (HonoAdapter functionality)
                const body = await context.adapter.getBody() as { url?: string };
                if (!body || !body.url) {
                    // If no URL, we default to floor price to show requirement.
                    return "0.01"; // Default floor price
                }

                // Validate and normalize URL before processing
                const sanitizedUrl = validateAndNormalizeYouTubeUrl(body.url);

                // Use prepareForWisdom to calculate price (and cache transcript/price!)
                // This ensures we don't do the heavy lifting twice.
                const result = await wisdomService.prepareForWisdom(sanitizedUrl);
                // WisdomService now returns Major Units (USDC string) e.g. "0.01"
                return result.price.amount;
            } catch (error) {
                if (error instanceof InvalidUrlError) {
                    throw new HTTPException(400, { message: error.message });
                }
                if (error instanceof TranscriptNotFoundError) {
                    throw new HTTPException(404, { message: error.message });
                }
                if (error instanceof TranscriptEmptyError) {
                    // Critical: Do NOT charge the user if the transcript is empty (logic error/unavailable content)
                    // Return 500 to signal server-side incompatibility with this video.
                    throw new HTTPException(500, { message: error.message });
                }
                throw error;
            }
        }
    },
    description: "Wisdom extracted from YouTube video",
    mimeType: "application/json",
    extensions: {
        // "Bazaar" Extension: Makes this API discoverable by AI agents.
        // We declare what inputs we accept so agents can auto-generate the client code.
        ...declareDiscoveryExtension({
            input: { url: "https://www.youtube.com/watch?v=s41p7Fvj1h8" }, // Example input
            inputSchema: {
                properties: {
                    url: {
                        type: "string",
                        description: "YouTube Video URL to extract wisdom from"
                    },
                    language: {
                        type: "string",
                        description: "Target language for the wisdom (e.g. 'en', 'es', 'pt')"
                    }
                },
                required: ["url"]
            },
            output: {
                example: {
                    summary: "A 25-word summary of the video content and presenter.",
                    ideas: ["Key idea extracted from the content (16 words each)."],
                    insights: ["Refined, abstracted insight from the content (16 words each)."],
                    quotes: ["Notable quote from the speaker with attribution."],
                    habits: ["Practical habit mentioned by the speaker (16 words each)."],
                    facts: ["Interesting fact about the world mentioned (16 words each)."],
                    references: ["Book, tool, or project mentioned by the speaker."],
                    one_sentence_takeaway: "The most important 15-word takeaway from the content.",
                    recommendations: ["Actionable recommendation from the content (16 words each)."]
                },
                schema: {
                    properties: {
                        summary: { type: "string", description: "25-word summary including presenter and topic" },
                        ideas: { type: "array", items: { type: "string" }, description: "20-50 surprising/insightful ideas (16 words each)" },
                        insights: { type: "array", items: { type: "string" }, description: "10-20 refined, abstracted insights (16 words each)" },
                        quotes: { type: "array", items: { type: "string" }, description: "15-30 notable quotes with speaker attribution" },
                        habits: { type: "array", items: { type: "string" }, description: "15-30 practical habits (16 words each)" },
                        facts: { type: "array", items: { type: "string" }, description: "15-30 interesting facts (16 words each)" },
                        references: { type: "array", items: { type: "string" }, description: "All mentioned books, tools, projects, sources" },
                        one_sentence_takeaway: { type: "string", description: "15-word sentence capturing the essence" },
                        recommendations: { type: "array", items: { type: "string" }, description: "15-30 actionable recommendations (16 words each)" }
                    },
                    required: ["summary", "ideas", "insights", "quotes", "habits", "facts", "references", "one_sentence_takeaway", "recommendations"]
                }
            }
        })
    }
};

/**
 * POST /wisdom
 * The main endpoint. It implements the "402 Payment Required" flow using middleware.
 * 
 * FLOW:
 * 1. User sends a request with a YouTube URL.
 * 2. `paymentMiddleware` intercepts the request.
 * 3. `paymentMiddleware` calculates the price dynamically using the `wisdomPaymentConfig.accepts.price` callback above.
 * 4. If NO payment signature is present:
 *    - `paymentMiddleware` rejects the request with HTTP 402.
 *    - It sends back the `WWW-Authenticate` header with pricing and instructions.
 * 5. If YES payment (User paid and sent signature):
 *    - `paymentMiddleware` verifies the token with the Facilitator.
 *    - If valid, it passes control to the handler below.
 * 6. The handler proceeds to generate the wisdom.
 */
app.post(
    "/wisdom",
    paymentMiddleware(
        { "POST /wisdom": wisdomPaymentConfig }, // Route config for this specific endpoint
        resourceServer
    ),
    async (c) => {
        try {
            const { url, language } = await c.req.json();

            // Validate and normalize URL (double-check in case of edge cases)
            const sanitizedUrl = validateAndNormalizeYouTubeUrl(url);

            // ==========================================
            // 5. DELIVER RESOURCE (After Payment Verified)
            // ==========================================
            // If code reaches here, payment is CONFIRMED by the middleware!
            // We can now incur the cost of calling the expensive AI model.
            // We reuse the cached transcript (fetched during the pricing step) to extract wisdom.
            const wisdom = await wisdomService.getWisdom(sanitizedUrl, language);
            return c.json(wisdom);

        } catch (e: any) {
            // Error Handling:
            // If something goes wrong logic-wise, we return a 500.
            // (The middleware handles 401/402/403 errors automatically)

            console.error("Application Error:", e);
            const status = e.status || 500;
            return c.json({ error: e.message || "Internal Server Error" }, status);
        }
    }
);

export default app;
