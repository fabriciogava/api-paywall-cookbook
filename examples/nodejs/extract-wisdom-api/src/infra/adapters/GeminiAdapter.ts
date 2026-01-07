import { AIProvider } from "../../core/ports/Interfaces.js";
import { Wisdom } from "../../core/entities/Types.js";
import { GoogleGenerativeAI, GenerativeModel } from "@google/generative-ai";

import { getSystemInstruction } from "../../core/prompts/ExtractWisdom.js";

// ==========================================
// INFRASTRUCTURE ADAPTER (GEMINI API)
// ==========================================
// This class implements the "AIProvider" interface defined in our core.
// It uses the simple API Key based Google Generative AI SDK.
export class GeminiAdapter implements AIProvider {
    private genAI: GoogleGenerativeAI;

    constructor(apiKey: string) {
        // Initialize the Google Generative AI client
        this.genAI = new GoogleGenerativeAI(apiKey);
    }

    /**
     * Extracts wisdom from the given transcript.
     * @param transcript The full text of the video.
     * @returns A Promise resolving to the Wisdom object (JSON).
     */
    async extractWisdom(transcript: string, outputLanguage: string, originalLanguage: string): Promise<Wisdom> {
        try {
            // Call the model with the user's content (the transcript)
            console.log(`[INFO] Calling Gemini API to extract wisdom...`);

            // Get the system instruction (with dynamic language instruction)
            const systemInstruction = getSystemInstruction(outputLanguage, originalLanguage);

            // Initialize model dynamically to include the custom system instruction
            const model = this.genAI.getGenerativeModel({
                model: "gemini-2.5-flash",
                systemInstruction: systemInstruction,
                generationConfig: {
                    responseMimeType: "application/json",
                }
            });

            const result = await model.generateContent(transcript);
            const response = result.response;
            const text = response.text();

            if (!text) {
                throw new Error("No response from Gemini");
            }

            // Log token usage for cost tracking
            const usage = response.usageMetadata;
            if (usage) {
                console.log(`[INFO] Gemini Token Usage: Input=${usage.promptTokenCount}, Output=${usage.candidatesTokenCount}, Total=${usage.totalTokenCount}`);
            }

            console.log(`[INFO] Gemini API response received. Length: ${text.length} characters.`);

            // Robust JSON parsing with sanitization
            const wisdom = this.parseJsonSafely(text);
            console.log(`[INFO] Wisdom extracted successfully.`);
            return wisdom;
        } catch (error) {
            console.error("Error calling Gemini API:", error);
            throw new Error("Failed to extract wisdom");
        }
    }

    /**
     * Attempts to parse JSON with sanitization for common LLM output issues.
     * LLMs can sometimes produce malformed JSON with unescaped characters.
     */
    private parseJsonSafely(text: string): Wisdom {
        // First, try direct parsing
        try {
            return JSON.parse(text) as Wisdom;
        } catch (firstError) {
            console.warn("[WARN] Initial JSON parse failed, attempting sanitization...");

            // Try to sanitize common issues:
            // 1. Remove any leading/trailing content outside JSON object
            let sanitized = text;
            const jsonStart = text.indexOf('{');
            const jsonEnd = text.lastIndexOf('}');

            if (jsonStart !== -1 && jsonEnd !== -1) {
                sanitized = text.slice(jsonStart, jsonEnd + 1);
            }

            // 2. Try parsing sanitized content
            try {
                return JSON.parse(sanitized) as Wisdom;
            } catch (secondError) {
                // Log the problematic content for debugging
                console.error("[ERROR] JSON parsing failed after sanitization.");
                console.error("[DEBUG] First 500 chars:", text.substring(0, 500));
                console.error("[DEBUG] Last 500 chars:", text.substring(text.length - 500));

                // Re-throw with more context
                throw new Error(`JSON parsing failed: ${firstError instanceof Error ? firstError.message : 'Unknown error'}`);
            }
        }
    }
}
