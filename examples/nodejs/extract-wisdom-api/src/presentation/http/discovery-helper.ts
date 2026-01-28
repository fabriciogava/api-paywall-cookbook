/**
 * Discovery Extension Helper for Kobaru Gateway
 *
 * This helper enriches the standard x402 SDK's declareDiscoveryExtension()
 * with additional metadata fields (tags, title, provider) that improve
 * discoverability in the Kobaru Bazaar.
 *
 * Copy this function into your project to use it.
 */

import { declareDiscoveryExtension } from '@x402/extensions/bazaar';

/**
 * Configuration for enriched discovery extension
 */
export interface EnrichedDiscoveryConfig {
    // Standard x402 SDK parameters
    method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';
    input?: Record<string, unknown>;
    inputSchema?: Record<string, unknown>;
    bodyType?: 'json' | 'form-data' | 'text';
    output?: {
        example?: unknown;
        schema?: Record<string, unknown>;
    };

    // Kobaru enrichment fields (available for registered merchants only)
    // Note: Public clients will have these fields filtered out automatically

    /**
     * Short, descriptive title for your API endpoint
     * @example "YouTube Wisdom Extractor"
     */
    title?: string;

    /**
     * Tags for discovery filtering and search
     * Use 2-5 specific, lowercase tags
     * @example ['ai', 'video-processing', 'content-analysis']
     */
    tags?: string[];

    /**
     * Provider/organization information
     * Helps consumers evaluate credibility
     */
    provider?: {
        /** Organization name */
        name: string;
        /** Brief description of your organization */
        description?: string;
        /** Organization website URL */
        url?: string;
        /** Contact email (optional) */
        contact?: string;
    };

    /**
     * Human-readable description of the endpoint
     * Note: This can also be set at the payment config level
     * @example "AI-powered analysis that extracts key insights from YouTube videos"
     */
    description?: string;

    /**
     * Pricing information (optional, auto-detected from payment requirements)
     */
    pricing?: {
        model: string;
        amount: string;
        asset: string;
    };
}

/**
 * Create an enriched discovery extension with tags, title, and provider info
 *
 * This function wraps the standard x402 SDK's declareDiscoveryExtension()
 * and adds Kobaru-specific enrichment fields for better discoverability.
 *
 * @param config - Configuration with both SDK and enrichment parameters
 * @returns Discovery extension object ready to use in payment config
 *
 * @example
 * ```typescript
 * // Basic usage
 * extensions: enrichDiscoveryExtension({
 *     method: "POST",
 *     input: { url: "https://youtube.com/watch?v=..." },
 *     inputSchema: {
 *         properties: {
 *             url: { type: \"string\", description: \"YouTube URL\" }
 *         },
 *         required: ["url"]
 *     },
 *     bodyType: "json",
 *     output: {
 *         example: { summary: \"...\", ideas: [...] }
 *     },
 *     title: \"YouTube Wisdom Extractor\",
 *     tags: ['ai', 'video-processing', 'content-analysis'],
 *     provider: {
 *         name: \"Your Company\",
 *         url: \"https://yourcompany.com\"
 *     }
 * })
 * ```
 */
export function enrichDiscoveryExtension(config: EnrichedDiscoveryConfig) {
    // Separate enrichment fields from SDK parameters
    const {
        title,
        tags,
        provider,
        description,
        pricing,
        ...sdkConfig
    } = config;

    // Call the standard x402 SDK function
    const baseDiscovery = declareDiscoveryExtension(sdkConfig as any);

    // Manually enrich the info object with Kobaru-specific metadata
    return {
        bazaar: {
            ...baseDiscovery.bazaar,
            info: {
                ...baseDiscovery.bazaar.info,
                // Add enrichment fields (only if provided)
                ...(title && { title }),
                ...(tags && { tags }),
                ...(provider && { provider }),
                ...(description && { description }),
                ...(pricing && { pricing })
            }
        }
    };
}
