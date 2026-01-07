import { YoutubeTranscript } from "youtube-transcript";

const urls = [
    "https://www.youtube.com/watch?v=dQw4w9WgXcQ", // Rick Roll (Control Positive)
    "https://www.youtube.com/watch?v=X2NAROGDnJQ", // Problematic video
    "https://www.youtube.com/watch?v=jNQXAC9IVRw", // Me at the zoo
];

async function run() {
    for (const url of urls) {
        console.log(`\n--- Testing URL: ${url} ---`);
        try {
            console.log("Fetching transcript (Default)...");
            const transcript = await YoutubeTranscript.fetchTranscript(url);
            console.log(`Result: ${transcript.length} items.`);

            if (transcript.length === 0) {
                console.log("⚠️  Empty. Retrying with explicit language...");

                let lang = 'en';
                if (url.includes("X2NAROGDnJQ")) lang = 'pt';

                try {
                    const transcriptLang = await YoutubeTranscript.fetchTranscript(url, { lang });
                    console.log(`Retry Result (${lang}): ${transcriptLang.length} items.`);
                    if (transcriptLang.length > 0) {
                        console.log(`First item (${lang}):`, transcriptLang[0]);
                    }
                } catch (retryError: any) {
                    console.error(`Retry Error (${lang}):`, retryError.message);
                }
            }
        } catch (e: any) {
            console.error("❌ Error fetching transcript:", e.message);
        }
    }
}

run();
