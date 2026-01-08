export interface Transcript {
    url: string;
    videoId: string;
    text: string;
    tokenCount: number;
    language: string;
    quotedPrice: string; // Cached price in major units (e.g., "0.02" USDC) for verification
}

export interface Pricing {
    amount: string;
    currency: string;
}

export interface Wisdom {
    summary: string;
    ideas: string[];
    quotes: string[];
    references: string[];
}
