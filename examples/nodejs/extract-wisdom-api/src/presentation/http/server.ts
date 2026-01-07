import { serve } from "@hono/node-server";
import app from "./app.js";
import { config } from "../../infra/config/index.js";

const port = parseInt(config.PORT);

console.log(`🧙 Wisdom API is listening on port ${port}`);
console.log(`💡 Send a POST to /wisdom to seek knowledge.`);

serve({
    fetch: app.fetch,
    port
});
