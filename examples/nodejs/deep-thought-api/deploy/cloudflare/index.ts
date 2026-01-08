/**
 * Cloudflare Workers entry point for Deep Thought API
 * 
 * Cloudflare Workers is a serverless platform that runs on the edge (very fast!).
 * 
 * Deploy with: npm run deploy:cloudflare
 * Dev server: npm run dev:cloudflare
 */
import { createApp } from "../../src/app";

// Cloudflare Workers environment bindings
// In Cloudflare, environment variables are passed into the `fetch` function,
// not stored in a global `process.env` like in Node.js.
interface Env {
    SOLANA_WALLET_ADDRESS?: string;
    BASE_WALLET_ADDRESS?: string;
    FACILITATOR_URL: string;
}

export default {
    // The fetch handler is the entry point for every request
    async fetch(request: Request, env: Env): Promise<Response> {
        // Initialize the app with the variables from the current request environment
        const app = createApp({
            solanaWalletAddress: env.SOLANA_WALLET_ADDRESS,
            baseWalletAddress: env.BASE_WALLET_ADDRESS,
            facilitatorUrl: env.FACILITATOR_URL,
        });

        // Let the Hono app handle the request
        return app.fetch(request);
    },
};
