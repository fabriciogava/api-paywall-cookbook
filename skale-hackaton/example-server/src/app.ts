/**
 * ============================================================================
 * DEEP THOUGHT API - SKALE HACKATHON EDITION
 * ============================================================================
 *
 * 🎯 SAN FRANCISCO AGENTIC COMMERCE X402 HACKATHON 🎯
 *
 * This is a TRIMMED version optimized for the hackathon.
 * Only SKALE networks are supported (Solana and Base removed for simplicity).
 *
 * For full multi-chain support (Solana, Base, SKALE), see the original:
 * 👉 https://github.com/kobaru/api-paywall-cookbook/tree/main/examples/nodejs/deep-thought-api
 *
 * ============================================================================
 */

// Hono is a lightweight web framework that works everywhere (Node.js, Cloudflare, Deno).
// Think of it like Express.js but modern and faster.
import { Hono } from "hono";
import { cors } from "hono/cors";

// These are the core tools for the x402 payment protocol
// paymentMiddleware: The guard that checks for payments
// x402ResourceServer: The logic that verifies if a payment is valid
import { paymentMiddleware, x402ResourceServer } from "@x402/hono";

// This import brings in support for the EVM blockchains (SKALE, Ethereum, Base, etc.)
// HACKATHON BUILD: Only EVM support - Solana (SVM) removed for simplicity
import { ExactEvmScheme } from "@x402/evm/exact/server";

// The Facilitator is your gateway to the complex world of blockchain.
// It handles checking the blockchain so you don't have to run your own node.
import { HTTPFacilitatorClient } from "@x402/core/server";

// Configuration interface - platform agnostic
// This separates "what code runs" from "where it runs" (Node vs Cloudflare)
//
// HACKATHON BUILD: Only SKALE wallet address required (Solana removed)
export interface AppConfig {
    skaleWalletAddress: string;  // Your SKALE wallet address to receive payments
    facilitatorUrl: string;      // x402 facilitator URL (defaults to Kobaru gateway)
    kobaruApiKey?: string;       // Optional Kobaru API key for authenticated requests
}

// ============================================================================
// SKALE HACKATHON NETWORK CONFIGURATION
// ============================================================================
//
// 🎯 PRE-CONFIGURED FOR SAN FRANCISCO AGENTIC COMMERCE X402 HACKATHON
//
// This example uses the SKALE Hackathon Sandbox (CAIP-2 format):
// "eip155:103698795"
//
// This is a test network where tokens have no real value.
// Perfect for hackathon development without spending real money!
//
// OTHER SKALE NETWORKS AVAILABLE:
// - SKALE Sepolia Testnet: "eip155:324705682"
// - SKALE Mainnet: "eip155:1187947933"
//
// To switch networks, just change the constants below.
const SKALE_NETWORK_ID = "eip155:103698795" as const; // Hackathon Sandbox (default)

// ============================================================================
// USDC TOKEN ADDRESS FOR SKALE HACKATHON SANDBOX
// ============================================================================
//
// This is the USDC token address on SKALE Hackathon Sandbox
const SKALE_USDC_ADDRESS = "0xc4083B1E81ceb461Ccef3FDa8A9F24F0d764B6D8";
//
// OTHER SKALE NETWORKS:
// - SKALE Sepolia: "0x2e08028E3C4c2356572E096d8EF835cD5C6030bD"
// - SKALE Mainnet: "0x85889c8c714505E0c94b30fcfcF64fE3Ac8FCb20"

/**
 * Asset metadata from the facilitator's /supported endpoint.
 * Contains everything needed to construct proper payment options:
 * - name/version: For EIP-712 domain separator (signature verification)
 * - decimals: For converting human-readable prices to atomic units
 */
interface AssetMetadata {
    name: string;
    version: string;
    decimals: number;
}

/**
 * Fetches asset metadata from the facilitator's /supported endpoint.
 * This is critical for:
 * 1. EIP-712 domain name (different chains use different names)
 * 2. Token decimals (for price conversion to atomic units)
 */
async function getAssetMetadata(
    facilitatorClient: HTTPFacilitatorClient,
    networkId: string,
    assetAddress: string
): Promise<AssetMetadata> {
    try {
        const supported = await facilitatorClient.getSupported();

        // Find the network entry that matches our network and asset address
        // The facilitator returns: { kinds: [{ network, extra: { asset, name, version, decimals } }] }
        const networkData = supported.kinds?.find(
            (kind: any) => kind.network === networkId &&
                kind.extra?.asset?.toLowerCase() === assetAddress.toLowerCase()
        );

        if (networkData?.extra) {
            const { name, version, decimals } = networkData.extra;
            console.log(`📝 Found asset metadata for ${networkId}: name="${name}", version="${version || "2"}", decimals=${decimals || 6}`);
            return {
                name: (name as string) || "USDC",
                version: (version as string) || "2",
                decimals: (decimals as number) || 6
            };
        }

        console.warn(`⚠️ No asset metadata found for ${networkId}/${assetAddress}, using defaults`);
    } catch (error) {
        console.warn(`⚠️ Failed to fetch asset metadata from facilitator:`, error);
    }

    // Fallback defaults (USDC standard: 6 decimals)
    return { name: "USDC", version: "2", decimals: 6 };
}

/**
 * Converts a human-readable price (e.g., "$0.001" or "0.001") to atomic units.
 * 
 * @param priceString - Price like "$0.001" or "0.001"  
 * @param decimals - Token decimals (e.g., 6 for USDC)
 * @returns Atomic units as string (e.g., "1000" for $0.001 USDC)
 * 
 * @example
 * priceToAtomicUnits("$0.001", 6) // "1000"
 * priceToAtomicUnits("1.50", 6)   // "1500000"
 */
function priceToAtomicUnits(priceString: string, decimals: number): string {
    // Remove $ prefix if present
    const cleanPrice = priceString.replace(/^\$/, '');
    const price = parseFloat(cleanPrice);

    if (isNaN(price)) {
        throw new Error(`Invalid price format: ${priceString}`);
    }

    // Convert to atomic units: price * 10^decimals
    // Use Math.round to handle floating point precision issues
    const atomicUnits = Math.round(price * Math.pow(10, decimals));
    return atomicUnits.toString();
}

/**
 * Creates the Deep Thought API application.
 * This function follows the Factory Pattern - it builds and returns the app
 * based on the configuration you provide. This makes testing nice and easy!
 * 
 * Note: This is async because it needs to fetch asset metadata from the facilitator
 * to get the correct EIP-712 domain name for each blockchain.
 */
export async function createApp(config: AppConfig) {
    // 1. Initialize the web server
    const app = new Hono();

    // 2. Security: Enable CORS (Cross-Origin Resource Sharing)
    // This allows websites (like a frontend app) to call your API
    app.use("*", cors());

    // 3. Setup the x402 Payment System
    // First, connect to the Facilitator (Kobaru)
    const facilitatorClient = new HTTPFacilitatorClient({
        url: config.facilitatorUrl,
        createAuthHeaders: async () => {
            const headers: Record<string, string> = {};
            if (config.kobaruApiKey) {
                headers["Authorization"] = `Bearer ${config.kobaruApiKey}`;
            }
            return {
                verify: headers,
                settle: headers,
                supported: headers
            };
        }
    });

    // Log API Key usage status
    if (config.kobaruApiKey) {
        console.log("🟢 Kobaru API Key configured - Using authenticated facilitator requests");
        console.log("   Benefits: Access to console logs, metrics, and enhanced features");
    } else {
        console.log("🟡 No Kobaru API Key found - Facilitator requests will be unauthenticated");
        console.log("   💡 Sign up at https://console.kobaru.io/sign-up to get your API key");
    }

    // Then, create the server that handles payment logic
    const resourceServer = new x402ResourceServer(facilitatorClient);

    // ========================================================================
    // HACKATHON BUILD: SKALE-ONLY PAYMENT CONFIGURATION
    // ========================================================================
    //
    // This simplified version only supports SKALE EVM networks.
    // The original Deep Thought API supports both Solana and Base/SKALE.

    // Fetch the correct asset metadata from facilitator
    // This is critical for chains like SKALE which use different token names
    const skaleAssetMeta = await getAssetMetadata(
        facilitatorClient,
        SKALE_NETWORK_ID,
        SKALE_USDC_ADDRESS
    );

    // Register the SKALE EVM payment scheme
    resourceServer.register(SKALE_NETWORK_ID, new ExactEvmScheme());

    // The price we want to charge (human-readable)
    const PRICE = "$0.001";

    // Build payment options array
    // Use AssetAmount format for universal EVM chain compatibility.
    // This bypasses the SDK's internal chain lookup (getDefaultAsset),
    // which only works for chains defined in viem.
    // With this format, ANY EVM chain works as long as the facilitator supports it.
    const paymentOptions = [{
        scheme: "exact" as const,
        price: {
            amount: priceToAtomicUnits(PRICE, skaleAssetMeta.decimals),
            asset: SKALE_USDC_ADDRESS,
            extra: {
                name: skaleAssetMeta.name,
                version: skaleAssetMeta.version
            }
        },
        network: SKALE_NETWORK_ID,
        asset: SKALE_USDC_ADDRESS,
        payTo: config.skaleWalletAddress,
        maxTimeoutSeconds: 300,
    }];

    // DEBUG: Log payment options to see what's being configured
    console.log("🔍 DEBUG: Payment Options:", JSON.stringify(paymentOptions, null, 2));

    // 4. Define Your Paywall Rules
    // This object maps your API endpoints to their price tags.
    const routes = {
        "GET /answer": {
            // "accepts" is an array of payment options.
            // You can list multiple networks here (e.g., Solana AND Base),
            // giving the user a choice of how to pay.
            accepts: paymentOptions,
            // Metadata nicely describes what the user is buying
            description: "The Answer to the Ultimate Question of Life, the Universe, and Everything",
            mimeType: "application/json",
        },
    };

    // DEBUG: Log all incoming requests
    app.use("*", async (c, next) => {
        const requestId = crypto.randomUUID();
        const prefix = `[${requestId}]`;

        console.log(`${prefix} ➡️  Incoming ${c.req.method} ${c.req.url}`);

        // Log Headers
        console.log(`${prefix} 📝 Headers:`, JSON.stringify(c.req.header(), null, 2));

        // Log Body if present
        const contentType = c.req.header("content-type");
        if (contentType && (contentType.includes("application/json") || contentType.includes("text/plain"))) {
            try {
                // Clone the request to read body without consuming it for the next middleware
                const body = await c.req.raw.clone().text();
                console.log(`${prefix} 📦 Request Body:`, body);
            } catch (e) {
                console.log(`${prefix} ⚠️  Could not read request body:`, e);
            }
        }

        await next();

        console.log(`${prefix} ⬅️  Response status: ${c.res.status}`);

        // Log Response Body
        // We need to clone the response to read it, but be careful with streams
        try {
            const resBody = await c.res.clone().text();
            console.log(`${prefix} 📤 Response Body:`, resBody.substring(0, 1000)); // Limit log size
        } catch (e) {
            console.log(`${prefix} ⚠️  Could not read response body (might be a stream or empty)`);
        }
    });

    // 5. Apply the Guard (Middleware)
    // "paymentMiddleware" sits in front of your routes and handles the entire x402 flow:
    //
    // 1. NO PAYMENT? 
    //    It blocks the request and returns 402 Payment Required with the options above.
    //
    // 2. HAS PAYMENT? (Authorization: 402 <token>)
    //    It automatically:
    //    a. Decodes the payment token from the header.
    //    b. Calls 'resourceServer.verify()' to check if the payment is valid.
    //    c. The 'resourceServer' asks the Facilitator (Kobaru): "Is this payment real?"
    //    d. If valid, it allows the request to pass to your handler below.
    //    e. If invalid, it returns 403 Forbidden.
    //
    // You don't need to write any manual validation code!
    app.use("*", paymentMiddleware(routes, resourceServer));

    // Root endpoint - free introduction
    // Good practice: Always have a free root endpoint so people know your API is alive
    app.get("/", (c) => {
        return c.json({
            name: "Deep Thought API",
            description:
                "After 7.5 million years of computation, I have calculated the Answer to the Ultimate Question of Life, the Universe, and Everything.",
            hint: "The answer awaits at /answer... for a small fee.",
            reference: "The Hitchhiker's Guide to the Galaxy - Douglas Adams",
            endpoints: {
                "/": "This introduction (free)",
                "/answer": "The Ultimate Answer (paid - $0.001)",
                "/health": "Health check (free)",
            },
        });
    });

    // The paid endpoint - THE ANSWER
    // Implementation note: You don't need to write any payment logic inside here!
    // If execution reaches this line, the user has definitely paid.
    app.get("/answer", (c) => {
        return c.json({
            question: "What is the Answer to the Ultimate Question of Life, the Universe, and Everything?",
            answer: 42,
            computationTime: "7.5 million years",
            computer: "Deep Thought",
            note: "I think the problem, to be quite honest with you, is that you've never actually known what the question is.",
            advice: "Perhaps you need an even greater computer to find the Question. I shall design it for you. And I shall call it... Earth.",
        });
    });

    // Health check endpoint (free)
    // Operations teams love these. It helps automated systems check if your server is running.
    app.get("/health", (c) => {
        return c.json({
            status: "operational",
            message: "Deep Thought is thinking...",
            uptime: "7,500,000 years and counting",
        });
    });

    return app;
}

// Default export makes it cleaner to import in other files
export default createApp;
