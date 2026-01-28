import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
    PORT: z.string().default("3000"),
    GOOGLE_API_KEY: z.string().min(1, "GOOGLE_API_KEY is required"),
    KOBARU_API_KEY: z.string().optional(),
    FACILITATOR_URL: z.string().default("https://gateway-staging.kobaru.io"),
    RESOURCE_WALLET_ADDRESS: z.string().min(1, "RESOURCE_WALLET_ADDRESS is required for receiving payments"),
    SOLANA_NETWORK_ID: z.string().default("solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1"), // Devnet
    USDC_ASSET_ADDRESS: z.string().default("4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU"), // Devnet USDC
});

const result = envSchema.safeParse(process.env);

if (!result.success) {
    console.error("❌ Invalid environment configuration:");
    result.error.issues.forEach((issue) => {
        console.error(`   - ${issue.path.join(".")}: ${issue.message}`);
    });
    process.exit(1);
}

export const config = result.data;
