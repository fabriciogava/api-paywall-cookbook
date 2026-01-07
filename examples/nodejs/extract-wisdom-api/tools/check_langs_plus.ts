import { fetchTranscript } from "youtube-transcript-plus";

const videoId = "https://www.youtube.com/watch?v=PrEa2eS8x6E"; // A video with multiple languages (hopefully)
// Or use a known one. "PrEa2eS8x6E" is "How to make a website" (often has translations). 
// Let's use the rick roll or something famous.
// "jNQXAC9IVRw" (Me at the zoo) might only have English.

// Kurzgesagt videos usually have many languages. 
// "W94ydDNPUQA" (The Egg)
const url = "https://www.youtube.com/watch?v=h6fcK_fRYaI"; // Kurzgesagt - The Egg (has many subs)

async function run() {
    console.log(`Checking video: ${url}`);

    // Test 1: Default fetch
    try {
        console.log("1. Fetching default...");
        const t1 = await fetchTranscript(url);
        console.log(`   Success. Items: ${t1.length}. Lang of first item: ${t1[0].lang}`);
    } catch (e: any) {
        console.log(`   Failed: ${e.message}`);
    }

    // Test 2: Fetch specific language (es)
    try {
        console.log("2. Fetching Spanish (es)...");
        const t2 = await fetchTranscript(url, { lang: 'es' });
        console.log(`   Success. Items: ${t2.length}. Lang of first item: ${t2[0].lang}`);
    } catch (e: any) {
        console.log(`   Failed: ${e.message}`);
    }

    // Test 3: Fetch invalid language (xx)
    try {
        console.log("3. Fetching Invalid (xx)...");
        const t3 = await fetchTranscript(url, { lang: 'xx' });
        console.log(`   Success. Items: ${t3.length}. Lang of first item: ${t3[0].lang}`);
    } catch (e: any) {
        console.log(`   Failed: ${e.message}`);
        if (e.availableLangs) {
            console.log("   Found availableLangs in error:", e.availableLangs);
        }
    }
}

run();
