import { WisdomService } from "../src/core/usecases/WisdomService.js";
import { YouTubeAdapter } from "../src/infra/adapters/YouTubeAdapter.js";
import { InMemoryStorage } from "../src/infra/adapters/InMemoryStorage.js";
import { AIProvider } from "../src/core/ports/Interfaces.js";
import { Wisdom } from "../src/core/entities/Types.js";

// Mock AI Provider to inspect the prompt
class MockAIProvider implements AIProvider {
    async extractWisdom(transcript: string, outputLanguage: string, originalLanguage: string): Promise<Wisdom> {
        console.log("\n--- Mock AI Provider Called ---");
        console.log(`Output Language: ${outputLanguage}`);
        console.log(`Original Language: ${originalLanguage}`);

        let promptSnippet = transcript.substring(0, 50) + "...";
        if (outputLanguage !== originalLanguage) {
            console.log("Transformation Logic Verification:");
            console.log(`Expected instruction: "TRANSLATE YOUR RESPONSE TO ${outputLanguage}..."`);
        } else {
            console.log("Restriction Logic Verification:");
            console.log(`Expected instruction: "RESTRICT YOUR ANSWER TO ${outputLanguage}..."`);
        }

        return {
            summary: "Mock Summary",
            ideas: ["Mock Idea"],
            quotes: ["Mock Quote"],
            references: []
        };
    }
}

async function run() {
    const youtubeAdapter = new YouTubeAdapter();
    const mockAI = new MockAIProvider();
    const storage = new InMemoryStorage();
    const service = new WisdomService(youtubeAdapter, mockAI, storage);

    const url = "https://www.youtube.com/watch?v=h6fcK_fRYaI"; // Kurzgesagt - The Egg (confirmed working)

    console.log("1. Preparing wisdom (fetching transcript)...");
    await service.prepareForWisdom(url);

    console.log("\n2. Getting wisdom (Default - No Lang)...");
    await service.getWisdom(url);

    console.log("\n3. Getting wisdom (Requested: 'pt')...");
    await service.getWisdom(url, 'pt');

    console.log("\n4. Getting wisdom (Requested: 'en' - assuming original is 'en')...");
    await service.getWisdom(url, 'en');
}

run();
