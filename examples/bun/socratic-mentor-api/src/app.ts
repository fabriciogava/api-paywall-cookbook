import { Hono } from "hono";
import { cors } from "hono/cors";
import { secureHeaders } from "hono/secure-headers";
import { x402ResourceServer } from "@x402/hono";
import { HTTPFacilitatorClient } from "@x402/core/server";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { createStateManager } from "./lib/state.js";
import { createGeneralRoutes } from "./routes/general.js";
import { createAskRoute } from "./routes/ask.js";
import { startPruningService } from "./services/cleanup.js";
import { requestIdMiddleware } from "./middleware/request-id.js";

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

    // 1. Initialize Middleware
    // Request ID for tracing
    app.use("*", requestIdMiddleware());

    // Security headers
    app.use("*", secureHeaders({
        strictTransportSecurity: "max-age=31536000; includeSubDomains",
        xContentTypeOptions: "nosniff",
        xFrameOptions: "DENY",
        contentSecurityPolicy: {
            defaultSrc: ["'self'"]
        }
    }));

    // CORS: Wildcard (*) is intentional for this public API.
    // - The API is designed to serve ANY paying client on the internet
    // - Payment via x402 is the access control mechanism, not origin restrictions
    // - Most consumers are AI agents/servers which bypass CORS entirely
    // - No cookies or session-based auth that could be exploited via CSRF
    app.use("*", cors());

    // Custom logger with request ID
    app.use("*", async (c, next) => {
        const requestId = (c.get("requestId") as string) || "unknown";
        console.log(`[${new Date().toISOString()}] [${requestId}] ${c.req.method} ${c.req.path}`);
        await next();
        console.log(`[${new Date().toISOString()}] [${requestId}] Completed ${c.req.method} ${c.req.path} - Status: ${c.res.status}`);
    });

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

    // CRITICAL: Wallet and network configuration is required for paid API
    if (!config.skaleWalletAddress || !config.skaleNetworkId) {
        throw new Error(
            "FATAL: Missing required payment configuration. " +
            "SKALE_WALLET_ADDRESS and SKALE_NETWORK_ID environment variables must be set."
        );
    }
    resourceServer.register(config.skaleNetworkId as any, new ExactEvmScheme());

    // 4. Fetch Asset Decimals - CRITICAL: Must succeed for payments to work
    let assetMetadata = { decimals: 6, name: "USDC", version: "1" };
    try {
        console.log("Fetching Supported Assets from Facilitator...");
        const supported = await facilitatorClient.getSupported();

        if (!supported.kinds || supported.kinds.length === 0) {
            throw new Error("Facilitator returned no supported payment methods");
        }

        const networkData = supported.kinds.find((k: any) => k.network === config.skaleNetworkId);
        if (!networkData) {
            throw new Error(
                `Facilitator does not support network: ${config.skaleNetworkId}. ` +
                `Available networks: ${supported.kinds.map((k: any) => k.network).join(", ")}`
            );
        }

        if (networkData.extra) {
            assetMetadata = {
                decimals: (networkData.extra.decimals as number) || 6,
                name: (networkData.extra.name as string) || "USDC",
                version: (networkData.extra.version as string) || "1"
            };
        }
        console.log("✅ Asset metadata loaded:", assetMetadata);
    } catch (e) {
        throw new Error(
            `FATAL: Cannot reach facilitator at ${config.facilitatorUrl}. ` +
            `Payments will not work. Error: ${e instanceof Error ? e.message : String(e)}`
        );
    }

    // 5. Register Routes
    // General Routes (Health, Index)
    app.route("/", createGeneralRoutes());

    // Ask Route (Protected)
    app.route("/ask", createAskRoute(config, stateManager, resourceServer, assetMetadata));

    console.log("App Created!");

    // Return app and cleanup function for graceful shutdown
    return {
        app,
        stateManager,
        shutdown: () => {
            console.log("Shutting down gracefully...");
            stateManager.close();
            console.log("Database connection closed.");
        }
    };
}
