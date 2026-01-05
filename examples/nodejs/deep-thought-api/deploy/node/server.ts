/**
 * Node.js server entry point for Deep Thought API
 * 
 * This file is the "adapter" that takes our platform-agnostic Hono app
 * and runs it on a standard Node.js server.
 * 
 * Run with: npm run dev:node
 */
import "dotenv/config"; // Loads variables from .env file into process.env
import { serve } from "@hono/node-server";
import { createApp } from "../../src/app";

// 1. Load configuration from environment variables
// Always separate secrets (like wallet addresses) from code!
const config = {
    resourceWalletAddress: process.env.RESOURCE_WALLET_ADDRESS || "",
    // You can host your own facilitator or use the public one from Kobaru
    facilitatorUrl: process.env.FACILITATOR_URL || "https://gateway.kobaru.io",
};

// 2. Validate essential configuration
// We fail fast (exit immediately) if the wallet address is missing.
// It's better to crash on startup than to run without receiving payments!
if (!config.resourceWalletAddress) {
    console.error("❌ RESOURCE_WALLET_ADDRESS environment variable is required");
    console.error("   Set it in your .env file or environment");
    process.exit(1);
}

// 3. Create the application instance
// This is where we inject our dependencies (the config)
const app = createApp(config);

// 4. Determine the port
// Cloud platforms usually provide a PORT specific to the environment
const port = parseInt(process.env.PORT || "3000", 10);

console.log(`
🧠 Deep Thought API
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Server running at: http://localhost:${port}
  
  Endpoints:
    GET /        → API introduction (free)
    GET /answer  → The Ultimate Answer (paid - $0.001)
    GET /health  → Health check (free)

  Facilitator: ${config.facilitatorUrl}
  Wallet: ${config.resourceWalletAddress.slice(0, 8)}...

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);

// 5. Start the server
// The 'serve' function from @hono/node-server is a lightweight wrapper
// around Node's native http.createServer.
serve({
    fetch: app.fetch,
    port,
});
