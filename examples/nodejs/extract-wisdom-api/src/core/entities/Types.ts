export interface Transcript {
    url: string;
    videoId: string;
    text: string;
    tokenCount: number;
    language: string;
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
