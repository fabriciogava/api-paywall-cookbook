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

// The Facilitator is your gateway to the complex world of blockchain.
// It handles checking the blockchain so you don't have to run your own node.
import { HTTPFacilitatorClient } from "@x402/core/server";

// Configuration interface - platform agnostic
// This separates "what code runs" from "where it runs" (Node vs Cloudflare)
export interface AppConfig {
    resourceWalletAddress: string;
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

// ⚠️ USDC on Devnet ⚠️
// This is the address for the content USDC token on the Solana Devnet.
// "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU"
//
// TO GO TO PRODUCTION:
// You MUST change this to the Solana Mainnet USDC address as stated. For USDC check https://developers.circle.com/stablecoins/usdc-contract-addresses
const ASSET_ADDRESS = "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU";

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
    // We register the "ExactSvmScheme" for the Solana network.
    // This tells the server: "If you see a payment request on Solana, use this logic to verify it."
    const resourceServer = new x402ResourceServer(facilitatorClient)
        .register(NETWORK_ID, new ExactSvmScheme());

    // 4. Define Your Paywall Rules
    // This object maps your API endpoints to their price tags.
    const routes = {
        "GET /answer": {
            // "accepts" is an array of payment options.
            // You can list multiple networks here (e.g., Solana AND Base),
            // giving the user a choice of how to pay.
            accepts: [
                {
                    // "scheme: exact" means the user must pay exactly the amount specified
                    scheme: "exact" as const,

                    // The price in USD. The protocol handles converting this to crypto amounts.
                    price: "$0.001", // A mere 0.1 cents for the ultimate answer

                    // Which blockchain network to use (Solana Devnet in this case)
                    network: NETWORK_ID,

                    // The asset you want to receive (USDC on Devnet)
                    asset: ASSET_ADDRESS,

                    // Where should the money go? Your wallet address!
                    payTo: config.resourceWalletAddress,
                },
            ],
            // Metadata nicely describes what the user is buying
            description: "The Answer to the Ultimate Question of Life, the Universe, and Everything",
            mimeType: "application/json",
        },
    };

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
