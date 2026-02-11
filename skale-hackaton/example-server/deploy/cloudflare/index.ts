/**
 * Cloudflare Workers entry point for Deep Thought API - SKALE Hackathon Edition
 *
 * Cloudflare Workers is a serverless platform that runs on the edge (very fast!).
 *
 * Deploy with: npm run deploy:cloudflare
 * Dev server: npm run dev:cloudflare
 *
 * 🎯 HACKATHON BUILD: Only SKALE networks supported
 */
import { createApp } from "../../src/app";

// Cloudflare Workers environment bindings
// In Cloudflare, environment variables are passed into the `fetch` function,
// not stored in a global `process.env` like in Node.js.
interface Env {
    SKALE_WALLET_ADDRESS: string;
    FACILITATOR_URL: string;
    KOBARU_API_KEY?: string;
}

export default {
    // The fetch handler is the entry point for every request
    async fetch(request: Request, env: Env): Promise<Response> {
        // Initialize the app with the variables from the current request environment
        // Note: createApp is async because it fetches asset metadata from the facilitator
        const app = await createApp({
            skaleWalletAddress: env.SKALE_WALLET_ADDRESS,
            facilitatorUrl: env.FACILITATOR_URL || "https://gateway.kobaru.io",
            kobaruApiKey: env.KOBARU_API_KEY,
        });

        // Let the Hono app handle the request
        return app.fetch(request);
    },
};
