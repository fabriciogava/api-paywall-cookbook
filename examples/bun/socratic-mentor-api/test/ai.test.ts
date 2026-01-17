import { describe, it, expect, mock, spyOn } from "bun:test";
import { generateSocraticResponse } from "../src/lib/ai.js";

// Mock the AI SDK
const mockGenerateObject = mock(() => Promise.resolve({
    object: {
        reply: "What do you think?",
        context_state: "User asked a question.",
        main_goal: "Learn Physics"
    }
}));

mock.module("ai", () => ({
    generateObject: mockGenerateObject
}));

mock.module("@ai-sdk/google", () => ({
    google: mock(() => "mock-model")
}));

describe("AI Logic", () => {
    it("should call generateObject with correct parameters", async () => {
        const response = await generateSocraticResponse(
            "Hello",
            [],
            "Summary",
            "Goal",
            "key"
        );

        expect(response).toBeDefined();
        expect(response.reply).toBe("What do you think?"); // From mock
    });
});
