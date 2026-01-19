import { createApp } from "../../src/app.js";

const config = {
  skaleWalletAddress: process.env.SKALE_WALLET_ADDRESS,
  skaleNetworkId: process.env.SKALE_NETWORK_ID || "eip155:324705682", // Default to Testnet
  skaleAssetAddress: process.env.SKALE_ASSET_ADDRESS || "0x2e08028E3C4c2356572E096d8EF835cD5C6030bD", // Default to USDC Testnet
  facilitatorUrl: process.env.FACILITATOR_URL || "https://gateway.kobaru.io",
  kobaruApiKey: process.env.KOBARU_API_KEY,
  googleApiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
  dbPath: process.env.DB_PATH || "socratic.db"
};

const { app, shutdown } = await createApp(config);
const port = parseInt(process.env.PORT || "3000", 10);

// Graceful shutdown handlers
process.on("SIGTERM", () => {
  console.log("Received SIGTERM, shutting down...");
  shutdown();
  process.exit(0);
});

process.on("SIGINT", () => {
  console.log("Received SIGINT, shutting down...");
  shutdown();
  process.exit(0);
});

console.log(`
🎓 Socratic Mentor API (Bun Runtime)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Server: http://localhost:${port}
  Runtime: Bun v${Bun.version}
  Wallet: ${config.skaleWalletAddress || "(not set)"}
  Gateway: ${config.facilitatorUrl}
  Kobaru API Key: ${config.kobaruApiKey ? "(configured)" : "(not set)"}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);

export default {
  port,
  fetch: app.fetch,
};

