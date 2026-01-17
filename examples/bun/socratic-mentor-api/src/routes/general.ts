import { Hono } from "hono";

export function createGeneralRoutes() {
    const app = new Hono();

    app.get("/", (c) => {
        return c.json({
            name: "Socratic Mentor API",
            description: "A wise AI tutor that helps you find the answer yourself.",
            endpoints: {
                "POST /ask": "Ask a question (Paid per character)",
                "GET /health": "System status"
            }
        });
    });

    app.get("/health", (c) => c.json({ status: "operational" }));

    return app;
}
