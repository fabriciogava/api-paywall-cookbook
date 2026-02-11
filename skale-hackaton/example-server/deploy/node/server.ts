/**
 * Node.js server entry point for Deep Thought API - SKALE Hackathon Edition
 *
 * This file is the "adapter" that takes our platform-agnostic Hono app
 * and runs it on a standard Node.js server.
 *
 * Run with: npm run dev:node
 *
 * 🎯 HACKATHON BUILD: Only SKALE networks supported
 */
import "dotenv/config"; // Loads variables from .env file into process.env
import { serve } from "@hono/node-server";
import { createApp } from "../../src/app";

// 1. Load configuration from environment variables
// Always separate secrets (like wallet addresses) from code!
const config = {
  skaleWalletAddress: process.env.SKALE_WALLET_ADDRESS || "",
  // You can host your own facilitator or use the public one from Kobaru
  facilitatorUrl: process.env.FACILITATOR_URL || "https://gateway.kobaru.io",
  // Optional Kobaru API key for authenticated facilitator requests
  kobaruApiKey: process.env.KOBARU_API_KEY,
};

// 2. Validate essential configuration
// We fail fast (exit immediately) if the wallet address is missing.
// It's better to crash on startup than to run without receiving payments!
if (!config.skaleWalletAddress) {
  console.error("❌ SKALE_WALLET_ADDRESS is required");
  console.error("   Set SKALE_WALLET_ADDRESS in your .env file");
  console.error("");
  console.error("   💡 HACKATHON TIP: Join the Telegram for testnet funds:");
  console.error("      https://t.me/c/2825693624/538");
  process.exit(1);
}

// 3. Create the application instance (async)
// This is where we inject our dependencies (the config)
// Note: createApp is async because it fetches asset metadata from the facilitator
async function main() {
  const app = await createApp(config);

  // 4. Determine the port
  // Cloud platforms usually provide a PORT specific to the environment
  const port = parseInt(process.env.PORT || "3000", 10);

  console.log(`
🧠 Deep Thought API - SKALE Hackathon Edition
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  🎯 San Francisco Agentic Commerce x402 Hackathon

  Server running at: http://localhost:${port}

  Endpoints:
    GET /        → API introduction (free)
    GET /answer  → The Ultimate Answer (paid - $0.001)
    GET /health  → Health check (free)

  Network: SKALE Hackathon Sandbox
  Facilitator: ${config.facilitatorUrl}
  SKALE Wallet: ${config.skaleWalletAddress.slice(0, 8)}...

  💡 For multi-chain support (Solana + Base + SKALE):
     https://github.com/kobaru/api-paywall-cookbook

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);

  // 5. Start the server
  // The 'serve' function from @hono/node-server is a lightweight wrapper
  // around Node's native http.createServer.
  serve({
    fetch: app.fetch,
    port,
  });
}

main().catch(console.error);
