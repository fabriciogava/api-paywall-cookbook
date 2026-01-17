import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { x402ResourceServer } from "@x402/hono";
import { HTTPFacilitatorClient } from "@x402/core/server";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { createStateManager } from "./lib/state.js";
import { createGeneralRoutes } from "./routes/general.js";
import { createAskRoute } from "./routes/ask.js";
import { startPruningService } from "./services/cleanup.js";

export interface AppConfig {
    skaleWalletAddress?: string;
    skaleNetworkId?: string;
    skaleAssetAddress?: string;
    facilitatorUrl: string;
    dbPath?: string;
    googleApiKey?: string;
    port?: number;
    pruneInterval?: number; // Milliseconds, default 1 hour
    sessionMaxAge?: number; // Seconds, default 90 days
}

export async function createApp(config: AppConfig) {
    console.log("Creating App...");
    const app = new Hono();

    // Custom Logger
    app.use("*", async (c, next) => {
        console.log(`[${new Date().toISOString()}] ${c.req.method} ${c.req.path}`);
        await next();
        console.log(`[${new Date().toISOString()}] Completed ${c.req.method} ${c.req.path} - Status: ${c.res.status}`);
    });

    // 1. Initialize Core Services
    app.use("*", cors());
    app.use("*", logger());

    const stateManager = createStateManager(config.dbPath);

    // 2. Start Background Services
    const PRUNE_INTERVAL = config.pruneInterval || 1000 * 60 * 60; // 1 Hour
    const MAX_AGE_SECONDS = config.sessionMaxAge || 60 * 60 * 24 * 90; // 90 Days

    startPruningService(stateManager, PRUNE_INTERVAL, MAX_AGE_SECONDS);

    // 3. Setup x402 Support
    const facilitatorClient = new HTTPFacilitatorClient({
        url: config.facilitatorUrl
    });

    const resourceServer = new x402ResourceServer(facilitatorClient);

    if (config.skaleWalletAddress && config.skaleNetworkId) {
        resourceServer.register(config.skaleNetworkId as any, new ExactEvmScheme());
    } else {
        console.warn("⚠️ No wallet address or network configured. Payments will fail.");
    }

    // 4. Fetch Asset Decimals (Simplified per refactor)
    let assetMetadata = { decimals: 6, name: "USDC", version: "1" };
    try {
        console.log("Fetching Supported Assets...");
        const supported = await facilitatorClient.getSupported();
        const networkData = supported.kinds?.find((k: any) => k.network === config.skaleNetworkId);
        if (networkData?.extra) {
            assetMetadata = {
                decimals: (networkData.extra.decimals as number) || 6,
                name: (networkData.extra.name as string) || "USDC",
                version: (networkData.extra.version as string) || "1"
            };
            console.log("Asset metadata loaded:", assetMetadata);
        }
    } catch (e) {
        console.error("Failed to fetch asset metadata, using defaults", e);
    }

    // 5. Register Routes
    // General Routes (Health, Index)
    app.route("/", createGeneralRoutes());

    // Ask Route (Protected)
    app.route("/ask", createAskRoute(config, stateManager, resourceServer, assetMetadata));

    console.log("App Created!");
    return app;
}
