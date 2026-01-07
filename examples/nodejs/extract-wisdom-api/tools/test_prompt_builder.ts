import { getSystemInstruction } from "../src/core/prompts/ExtractWisdom.js";

function test() {
    console.log("--- Testing getSystemInstruction ---");

    // Test 1: No language requested (Output == Original)
    // Expect: "RESTRICT YOUR ANSWER TO en"
    const p1 = getSystemInstruction("en", "en");
    if (p1.includes("RESTRICT YOUR ANSWER TO en")) {
        console.log("PASS: No translation (Restrict to 'en')");
    } else {
        console.error("FAIL: No translation. Got translation instruction or missing restriction.");
    }

    // Test 2: With language requested (Output != Original)
    // Expect: "TRANSLATE YOUR RESPONSE TO pt"
    const p2 = getSystemInstruction("pt", "en");
    if (p2.includes("TRANSLATE YOUR RESPONSE TO pt")) {
        console.log("PASS: Translation to 'pt'");
    } else {
        console.error("FAIL: Translation. Instructions missing.");
    }
}

test();
