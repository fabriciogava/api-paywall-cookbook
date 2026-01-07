import { TranscriptFetcher } from "../../core/ports/Interfaces.js";
import { fetchTranscript } from "youtube-transcript-plus";
import { TranscriptNotFoundError, TranscriptEmptyError } from "../../core/entities/Errors.js";

// Error names from youtube-transcript-plus that indicate video/transcript not found
const YOUTUBE_NOT_FOUND_ERRORS = [
    "YoutubeTranscriptNotAvailableError",
    "YoutubeTranscriptDisabledError",
    "YoutubeTranscriptInvalidVideoIdError",
    "YoutubeTranscriptVideoUnavailableError"
];

// ==========================================
// INFRASTRUCTURE ADAPTER (YOUTUBE)
// ==========================================
// Implements "TranscriptFetcher" interface.
// Uses "youtube-transcript-plus" to scrape subtitles from YouTube videos.
export class YouTubeAdapter implements TranscriptFetcher {
    /**
     * Fetches the transcript text from a given YouTube URL.
     * @param url The full YouTube video URL.
     * @returns The raw text of the video's subtitles.
     */
    async fetch(url: string): Promise<{ text: string; language: string }> {
        try {
            console.log(`[INFO] Fetching transcript for URL: ${url}`);

            // "youtube-transcript-plus" offers better reliability and specific errors.
            const transcripts = await fetchTranscript(url);

            console.log(`[DEBUG] Raw transcripts array length: ${transcripts.length}`);
            if (!transcripts || transcripts.length === 0) {
                console.warn(`[WARN] Transcripts array is empty!`);
                throw new TranscriptEmptyError(url);
            } else {
                console.log(`[DEBUG] First transcript segment:`, transcripts[0]);
            }

            // We only care about the text content for the LLM.
            // Join all the pieces with spaces to create one long string.
            const text = transcripts.map((t) => t.text).join(" ");
            const language = transcripts[0].lang || "en"; // Default to 'en' if missing

            if (!text.trim()) {
                console.warn(`[WARN] Transcript text is empty after join!`);
                throw new TranscriptEmptyError(url);
            }

            console.log(`[INFO] Successfully fetched transcript. Length: ${text.length} characters. Language: ${language}`);
            // console.log(`[DEBUG] Full Transcript Text: "${text}"`); // Commented out to reduce noise
            return { text, language };
        } catch (error: any) {
            console.error("Error fetching YouTube transcript:", error.message);

            // 1. Logic Errors (500) - prevent charge
            if (error instanceof TranscriptEmptyError) {
                throw error;
            }

            // 2. Not Found Errors (404)
            if (YOUTUBE_NOT_FOUND_ERRORS.includes(error?.name)) {
                throw new TranscriptNotFoundError(url, `Transcript not available: ${error.message}`);
            }

            // Fallback for unknown errors (treat as 404 to be safe)
            throw new TranscriptNotFoundError(url);
        }
    }
}
