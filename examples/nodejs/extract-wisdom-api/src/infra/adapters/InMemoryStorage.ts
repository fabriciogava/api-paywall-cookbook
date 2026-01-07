import { Storage } from "../../core/ports/Interfaces.js";
import { Transcript } from "../../core/entities/Types.js";

export class InMemoryStorage implements Storage {
    private cache: Map<string, Transcript> = new Map();

    async saveTranscript(key: string, transcript: Transcript): Promise<void> {
        console.log(`[INFO] Saving transcript to cache. Key: ${key}`);
        this.cache.set(key, transcript);
    }

    async getTranscript(key: string): Promise<Transcript | null> {
        const transcript = this.cache.get(key);
        if (transcript) {
            console.log(`[INFO] Cache HIT for key: ${key}`);
            return transcript;
        }
        console.log(`[INFO] Cache MISS for key: ${key}`);
        return null;
    }
}
