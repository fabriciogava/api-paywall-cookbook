import { Transcript, Wisdom } from "../entities/Types.js";

export interface AIProvider {
    extractWisdom(transcript: string, outputLanguage: string, originalLanguage: string): Promise<Wisdom>;
}

export interface TranscriptFetcher {
    fetch(url: string): Promise<{ text: string; language: string }>; // Returns raw text and detected language
}

export interface Storage {
    saveTranscript(key: string, transcript: Transcript): Promise<void>;
    getTranscript(key: string): Promise<Transcript | null>;
}
