import { x402Client, wrapFetchWithPayment } from "@x402/fetch";
import { registerExactSvmScheme } from "@x402/svm/exact/client";
import { createKeyPairSignerFromBytes } from "@solana/signers";
import { base58 } from "@scure/base";
import dotenv from "dotenv";
import * as readline from 'readline';

dotenv.config();

// 🎯 CONFIGURATION: Default Target
// You can override this by passing a URL as an argument: npm start https://example.com/api
const DEFAULT_TARGET_URL = "http://localhost:3000/answer";
const SOLANA_MAINNET_GENESIS = "5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp";

// Custom logging helper for clarity
const logSection = (title: string, icon: string = "📝") => {
    console.log(`\n${icon} ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`   ${title.toUpperCase()}`);
    console.log(`   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
};

const logInfo = (message: string) => console.log(`   ℹ️  ${message}`);
const logDetail = (label: string, value: any) => console.log(`      ▪️ ${label}: ${typeof value === 'object' ? JSON.stringify(value, null, 2) : value}`);
const logExplanation = (text: string) => console.log(`      💡 EDUCATIONAL INTEL: ${text}`);

const askQuestion = (query: string): Promise<string> => {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });
    return new Promise(resolve => rl.question(query, ans => {
        rl.close();
        resolve(ans);
    }));
};

async function main() {
    logSection("AGENT 007 INITIALIZED - CODENAME: PAYWALL AUDITOR", "🕵️");

    const privateKey = process.env.SVM_PRIVATE_KEY;
    if (!privateKey) {
        console.error("❌ CRITICAL FAILURE: MISSING CREDENTIALS (SVM_PRIVATE_KEY).");
        console.error("   Decode instructions located in .env.example. Aborting mission.");
        process.exit(1);
    }

    // Initialize Client
    const client = new x402Client();

    // 1. Configure "Spy Glasses" - Hooks for educational logging
    client
        .onBeforePaymentCreation(async (context) => {
            logSection("PHASE 2: ANALYZING SECURITY PROTOCOL", "🛑");
            logInfo("The target server stopped us with a '402 Payment Required' status.");
            logExplanation("Think of this as a digital bouncer. It says 'You can't come in unless you pay'.");

            // Cast to any to access dynamic properties for logging
            const serverReqs = context.paymentRequired as any;
            const selected = context.selectedRequirements as any;

            logInfo("Extracting payment requirements from the 'WWW-Authenticate' header...");
            logDetail("Raw Server Requirements", serverReqs);

            logExplanation("The server sent a 'Challenge'. It tells us:");
            logDetail("Scheme (How to pay)", selected.scheme);
            let displayPrice = "Unknown";
            if (selected.amount) {
                const isUsdc = [
                    "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU", // Devnet USDC
                    "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"  // Mainnet USDC
                ].includes(selected.asset);

                if (isUsdc) {
                    displayPrice = `${Number(selected.amount) / 1_000_000} USDC`;
                } else {
                    displayPrice = `${selected.amount} atomic units of unknown currency`;
                }
            }
            logDetail("Price (How much)", displayPrice);

            // Network Analysis
            const networkId = selected.network || "";
            const isMainnet = networkId.includes(SOLANA_MAINNET_GENESIS);

            logDetail("Network ID", networkId);
            logDetail("Environment Detected", isMainnet ? "🚨 MAINNET (REAL MONEY)" : "🧪 DEVNET/TESTNET");

            // INTERACTIVE SAFETY CHECK
            console.log("\n   ⚠️  MISSION CRITICAL DECISION REQUIRED");
            if (isMainnet) {
                logInfo("🚨 LIVE FIRE EXERCISE DETECTED [MAINNET]");
                logExplanation("You DO NOT have a 'License to Kill' (Spend Real Money) without explicit authorization.");
                const answer = await askQuestion("   ❓ CONFIRM REAL MONEY TRANSACTION? (Y/n): ");
                if (answer.toLowerCase() === 'n') {
                    throw new Error("Mission Aborted by Agent: Live fire authorization denied.");
                }
                logInfo("Authorization Confirmed. License to Spend granted for this mission.");
            } else {
                logInfo("🧪 SIMULATION MODE [DEVNET]");
                logExplanation("Environment secured. 'License to Kill' active: You may perform transactions at will.");
            }

            logInfo("Agent is preparing to sign the transaction...");
        })
        .onAfterPaymentCreation(async (context) => {
            logSection("PHASE 3: FABRICATING CREDENTIALS", "✅");
            logInfo("Payment transaction has been signed by your wallet.");
            logExplanation("We didn't just send money; we created a cryptographic proof that we paid/will pay.");

            logDetail("x402 Protocol Version", context.paymentPayload.x402Version);
            logInfo("Generated 'Authorization' Token Content:");
            logDetail("Token Data", context.paymentPayload.payload);

            logExplanation("This data will be encoded into base64 and put into the 'Authorization' header.");
            logExplanation("It looks like: Authorization: 402 <base64_data>");
        })
        .onPaymentCreationFailure(async (context) => {
            console.error("💥 COVER BLOWN: Payment creation failed:", context.error);
            logExplanation("Common reasons: Insufficient funds in wallet, wrong network (devnet vs mainnet), or invalid private key.");
        });

    // 2. Load the Wallet
    try {
        const signer = await createKeyPairSignerFromBytes(base58.decode(privateKey));
        logInfo(`Gadget Loaded: Wallet Address: ${signer.address}`);
        logExplanation("This is your digital identity. The server will charge this account.");
        registerExactSvmScheme(client, { signer });
    } catch (e) {
        console.error("💥 GADGET MALFUNCTION: Failed to register SVM scheme:", e);
        process.exit(1);
    }

    // 3. Create a Verbose Fetcher (The "Wiretap")
    // This wraps the standard fetch to log exactly what's going out and coming in.
    const verboseFetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
        const method = init?.method || "GET";
        const url = input.toString();

        console.log(`\n📨 OUTGOING HTTP REQUEST`);
        console.log(`   ➡️  ${method} ${url}`);
        if (init?.headers) {
            const headers = init.headers as Record<string, string>;
            if (headers['Authorization']) {
                console.log(`   🔑 Header [Authorization]: ${headers['Authorization'].substring(0, 50)}... (truncated)`);
                logExplanation("Notice the Authorization header is now attached! We are flashing our badge.");
            }
        }

        const start = performance.now();
        const response = await fetch(input, init);
        const duration = (performance.now() - start).toFixed(2);

        console.log(`\n📥 INCOMING HTTP RESPONSE`);
        console.log(`   ⬅️  Status: ${response.status} ${response.statusText}`);
        console.log(`   ⏱️  Remote Server Latency: ${duration}ms`);

        const wwwAuth = response.headers.get('www-authenticate');
        if (wwwAuth) {
            console.log(`   🔐 Header [WWW-Authenticate]: ${wwwAuth}`);
            logExplanation("This header contains the ingredients the agent needs to build the payment.");
        }

        return response;
    };

    // 4. Wrap our verbose fetch with the x402 payment logic
    const fetchWithPayment = wrapFetchWithPayment(verboseFetch, client);
    const targetUrl = process.argv[2] || DEFAULT_TARGET_URL;

    // URL Validation
    try {
        const url = new URL(targetUrl);
        if (!['http:', 'https:'].includes(url.protocol)) {
            console.error('❌ CRITICAL FAILURE: Invalid protocol detected.');
            console.error(`   Expected: http:// or https://`);
            console.error(`   Received: ${url.protocol}`);
            console.error('   Example: npm start http://localhost:3000/answer');
            process.exit(1);
        }
    } catch (e: unknown) {
        console.error('❌ CRITICAL FAILURE: Malformed URL provided.');
        console.error(`   Target: ${targetUrl}`);
        console.error('   Example: npm start http://localhost:3000/answer');
        process.exit(1);
    }

    logSection("PHASE 1: RECONNAISSANCE", "📡");

    logInfo(`Target: ${targetUrl}`);
    logExplanation("We are about to make the first request without any credentials to see if it's protected.");

    try {
        // Pass empty init object to satisfy @x402/fetch library requirement
        logInfo("Mission timer started...");
        const startTime = performance.now();
        const response = await fetchWithPayment(targetUrl, {});
        const duration = (performance.now() - startTime).toFixed(2);
        logDetail("Total mission duration", `${duration}ms`);

        logSection("PHASE 4: ACCESS GRANTED", "🍸");
        logInfo(`Final Status: ${response.status} ${response.statusText}`);

        let data;
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
            data = await response.json();
            logDetail("Decoded JSON Body", data);
        } else {
            data = await response.text();
            logDetail("Decoded Text Body", data);
        }

        if (response.ok) {
            logExplanation("Success! The server accepted our payment proof and returned the hidden data.");
            console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
            process.exit(0);
        } else {
            console.error("\n💀 MISSION FAILED. Target remains secure.");
            console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
            process.exit(1);
        }

    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error("\n💥 CRITICAL ERROR:", errorMessage);
        if (error instanceof Error && error.stack) {
            console.error("   Stack trace:", error.stack);
        }
        console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
        process.exit(1);
    }
}

main();
