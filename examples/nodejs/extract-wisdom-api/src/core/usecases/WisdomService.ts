import { Transcript, Wisdom, Pricing } from "../entities/Types.js";
import { AIProvider, TranscriptFetcher, Storage } from "../ports/Interfaces.js";
import { createHash } from "crypto";

// ==========================================
// CORE DOMAIN SERVICE
// ==========================================
// This class contains the "Business Logic" of our application.
// It is pure TypeScript and doesn't know about HTTP, Docker, or Google Cloud.
// It relies on "Ports" (Interfaces) to interact with the outside world.
export class WisdomService {

    // DEPENDENCY INJECTION
    // We ask for "TranscriptFetcher" (interface), not "YouTubeAdapter" (concrete class).
    // This respects the dependency inversion principle.
    constructor(
        private transcriptFetcher: TranscriptFetcher,
        private aiProvider: AIProvider,
        private storage: Storage
    ) { }

    /**
     * Generates a unique key for caching based on the URL.
     * We use a hash to ensure the key is safe and consistent.
     */
    private generateKey(url: string): string {
        return createHash("sha256").update(url).digest("hex");
    }

    /**
     * STEP 1: PREPARE AND PRICE
     * 
     * Before we charge the user, we need to know HOW MUCH to charge.
     * This method:
     * 1. Checks if we already have the transcript cached.
     * 2. If not, fetches it from YouTube.
     * 3. Calculates the price based on the token count (length).
     * 4. Saves it to cache so we don't need to fetch it again after payment.
     */
    async prepareForWisdom(url: string): Promise<{ transcript: Transcript; price: Pricing }> {
        // Check cache first to save bandwidth and time
        const key = this.generateKey(url);
        let transcript = await this.storage.getTranscript(key);

        if (!transcript) {
            // Not in cache, so we must work for it.
            // 1. Fetch text from the source (e.g. YouTube)
            const { text, language } = await this.transcriptFetcher.fetch(url);

            // 2. Count tokens (approximate). 
            // 1 token ~= 4 characters in English. This is standard for LLM pricing.
            const tokenCount = Math.ceil(text.length / 4);

            // Calculate price BEFORE creating the entity so we can cache it together
            const price = this.calculatePrice(tokenCount);

            // Create our Transcript entity with the quoted price
            transcript = {
                url,
                videoId: url, // Simplified logic
                text,
                tokenCount,
                language,
                quotedPrice: price.amount // Cache the quoted price for verification
            };

            // 3. Cache it! 
            // Important: We cache BEFORE payment so that when the user comes back 
            // with the payment token, the data is ready for the expensive AI step.
            await this.storage.saveTranscript(key, transcript);
        }

        // Return the cached price from the transcript (ensures consistency)
        const price: Pricing = { amount: transcript.quotedPrice, currency: "USDC" };
        return { transcript, price };
    }

    /**
     * Get the cached quoted price for a URL.
     * Returns null if no quote exists (client must call prepareForWisdom first).
     */
    async getQuotedPrice(url: string): Promise<string | null> {
        const key = this.generateKey(url);
        const transcript = await this.storage.getTranscript(key);
        return transcript?.quotedPrice ?? null;
    }

    /**
     * STEP 2: EXTRACT WISDOM (THE PAID SERVICE)
     * 
     * This method is only called AFTER payment is verified by the Presentation layer (app.ts).
     * It uses the AI Provider to analyze the text.
     * 
     * SECURITY: Requires a cached transcript with a quoted price.
     * If the cache is empty, the request is rejected (prevents bait-and-switch attacks).
     */
    async getWisdom(url: string, requestedLanguage?: string): Promise<Wisdom> {
        const key = this.generateKey(url);
        const transcript = await this.storage.getTranscript(key);

        if (!transcript) {
            // SECURITY: Do NOT re-fetch or prepare here.
            // If no cached quote exists, the client is trying to skip the pricing step.
            throw new Error("No cached quote found for this URL. Request a price first.");
        }

        // Call the AI Service (e.g. Vertex AI)
        // This is the "expensive" operation we protected with the paywall.

        // Determine the target output language.
        // If the user requested a language, use it. Otherwise, defaults to the transcript's original language.
        const outputLanguage = requestedLanguage || transcript.language;
        const originalLanguage = transcript.language;

        return this.aiProvider.extractWisdom(transcript.text, outputLanguage, originalLanguage);
    }

    /**
     * PRICING STRATEGY
     * 
     * Demonstrates "Dynamic Pricing" with a Minimum Floor using ATOMIC UNITS.
     * We calculate everything in integers (micro-USDC) to avoid floating point errors.
     * 
     * Cost Factor: 1 atomic unit per 1 token.
     *   (Equivalent to $0.0001 per 100 tokens, as 1 token = 1 unit = 0.000001 USDC)
     * 
     * Minimum Floor: 10,000 atomic units ($0.01).
     */
    // Made public to allow dynamic pricing in middleware.
    public calculatePrice(tokenCount: number): Pricing {
        const costPerToken = 1; // 1 atomic unit (micro-USDC) per token
        const rawPriceAtomic = tokenCount * costPerToken;

        // ENFORCE FLOOR PRICE: $0.01 = 10,000 atomic units
        const floorPriceAtomic = 10000;

        const finalPriceAtomic = Math.max(floorPriceAtomic, rawPriceAtomic);

        // Convert to Major Units (USDC)
        // 10,000 atomic units / 1,000,000 = 0.01 USDC
        const finalPriceMajor = finalPriceAtomic / 1_000_000;

        return {
            amount: finalPriceMajor.toString(), // Return as string "0.01"
            currency: "USDC"
        };
    }
}

