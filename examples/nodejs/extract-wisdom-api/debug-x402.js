import { x402ResourceServer, PaymentRequired } from "@x402/hono";
import { inspect } from "util";

console.log("Inspecting @x402/hono...");

try {
    console.log("PaymentRequired type:", typeof PaymentRequired);
    // Note: If it's a type, it will be undefined at runtime, but let's see.

    console.log("x402ResourceServer type:", typeof x402ResourceServer);
    if (typeof x402ResourceServer === 'function') {
        console.log("x402ResourceServer prototype:", Object.getOwnPropertyNames(x402ResourceServer.prototype));
    }

} catch (e) {
    console.error("Error:", e);
}
