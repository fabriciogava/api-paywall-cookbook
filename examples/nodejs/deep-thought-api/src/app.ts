// Hono is a lightweight web framework that works everywhere (Node.js, Cloudflare, Deno).
// Think of it like Express.js but modern and faster.
import { Hono } from "hono";
import { cors } from "hono/cors";

// These are the core tools for the x402 payment protocol
// paymentMiddleware: The guard that checks for payments
// x402ResourceServer: The logic that verifies if a payment is valid
import { paymentMiddleware, x402ResourceServer } from "@x402/hono";

// This import brings in support for the Solana blockchain (SVM = Solana Virtual Machine)
// We use 'ExactSvmScheme' to say "I want exactly this amount of crypto on Solana"
import { ExactSvmScheme } from "@x402/svm/exact/server";
// This import brings in support for the EVM blockchains (Ethereum, Base, etc.)
import { ExactEvmScheme } from "@x402/evm/exact/server";

// The Facilitator is your gateway to the complex world of blockchain.
// It handles checking the blockchain so you don't have to run your own node.
import { HTTPFacilitatorClient } from "@x402/core/server";

// Configuration interface - platform agnostic
// This separates "what code runs" from "where it runs" (Node vs Cloudflare)
export interface AppConfig {
    solanaWalletAddress?: string;
    baseWalletAddress?: string;
    facilitatorUrl: string;
}

// ⚠️ WARNING: THIS IS SOLANA DEVNET! ⚠️
//
// This example uses the Solana Devnet network identifier (CAIP-2 format):
// "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1"
//
// This is a test network where tokens have no real value.
// It's perfect for development without spending real money.
//
// TO GO TO PRODUCTION AND RECEIVE REAL FUNDS:
// You MUST change this to the Solana Mainnet Beta identifier:
// "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp"
const NETWORK_ID = "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1" as const;

// ⚠️ WARNING: THIS IS BASE SEPOLIA! ⚠️
//
// This example uses the Base Sepolia network identifier (CAIP-2 format):
// "eip155:84532"
//
// TO GO TO PRODUCTION:
// You MUST change this to the Base Mainnet identifier:
// "eip155:8453"
const BASE_NETWORK_ID = "eip155:84532" as const;

// ⚠️ USDC on Devnet ⚠️
// This is the address for the content USDC token on the Solana Devnet.
// "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU"
//
// TO GO TO PRODUCTION:
// You MUST change this to the Solana Mainnet USDC address as stated. For USDC check https://developers.circle.com/stablecoins/usdc-contract-addresses
const ASSET_ADDRESS = "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU";

// ⚠️ USDC on Base Sepolia ⚠️
// "0x036CbD53842c5426634e7929541eC2318f3dCF7e"
//
// TO GO TO PRODUCTION:
// You MUST change this to the Base Mainnet USDC address:
// "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
const BASE_ASSET_ADDRESS = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";

/**
 * Creates the Deep Thought API application.
 * This function follows the Factory Pattern - it builds and returns the app
 * based on the configuration you provide. This makes testing nice and easy!
 */
export function createApp(config: AppConfig) {
    // 1. Initialize the web server
    const app = new Hono();

    // 2. Security: Enable CORS (Cross-Origin Resource Sharing)
    // This allows websites (like a frontend app) to call your API
    app.use("*", cors());

    // 3. Setup the x402 Payment System
    // First, connect to the Facilitator (Kobaru)
    const facilitatorClient = new HTTPFacilitatorClient({ url: config.facilitatorUrl });

    // Then, create the server that handles payment logic
    const resourceServer = new x402ResourceServer(facilitatorClient);

    // We start building the accepted payment options
    const paymentOptions: any[] = [];

    // Check if Solana is enabled
    if (config.solanaWalletAddress) {
        resourceServer.register(NETWORK_ID, new ExactSvmScheme());
        paymentOptions.push({
            scheme: "exact" as const,
            price: "$0.001",
            network: NETWORK_ID,
            asset: ASSET_ADDRESS,
            payTo: config.solanaWalletAddress,
            maxTimeoutSeconds: 300,
            extra: {
                feePayer: config.solanaWalletAddress,
                name: "USDC",
                version: "2"
            }
        });
    }

    // Check if Base is enabled
    if (config.baseWalletAddress) {
        resourceServer.register(BASE_NETWORK_ID, new ExactEvmScheme());
        paymentOptions.push({
            scheme: "exact" as const,
            price: "$0.001",
            network: BASE_NETWORK_ID,
            asset: BASE_ASSET_ADDRESS,
            payTo: config.baseWalletAddress,
            maxTimeoutSeconds: 300,
            extra: {
                name: "USDC",
                version: "2"
            }
        });
    }

    // Ensure at least one network is configured
    if (paymentOptions.length === 0) {
        throw new Error("At least one wallet address (Solana or Base) must be configured.");
    }

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
