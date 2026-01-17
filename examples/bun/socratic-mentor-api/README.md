# Socratic Mentor API (Bun Edition)

A wise Socratic AI tutor that helps you find the answer yourself, monetized via the **x402 protocol**. This example allows you to run a **High-Performance** version of the API using the **Bun** runtime.

## Features

- **Socratic Method**: Uses a specialized system prompt to guide users rather than giving direct answers.
- **Paywall Integration**: Native x402 protocol support for micropayments via SKALE (or other EVM chains).
- **Stateful Conversations**: Maintains conversation context and "Main Goal" tracking using SQLite.
- **Dynamic Pricing**: Calculates price based on input length using `bun:sqlite` for state management.
- **High Performance**: Built on Bun + Hono for low-latency responses.

## Tech Stack

- **Runtime**: [Bun](https://bun.sh) (v1.1+)
- **Framework**: [Hono](https://hono.dev)
- **Payments**: x402 SDK v2
- **AI**: Vercel AI SDK (Google Gemini)
- **Database**: `bun:sqlite` (Native, fast SQLite)

## Prerequisites

- Bun v1.1.0 or higher
- A Google AI Studio API Key
- An EVM Wallet (public address only) to receive payments

## Setup

1. **Install Dependencies**:
   ```bash
   bun install
   ```

2. **Configure Environment**:
   Copy `.env.example` to `.env` and fill in your details:
   ```bash
   cp .env.example .env
   ```
   
   See [Configuration](#configuration) for details.

3. **Run Development Server**:
   ```bash
   bun run dev
   ```
   Server will start at `http://localhost:3000`.

## Configuration

The application is configured via environment variables:

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `SKALE_WALLET_ADDRESS` | EVM address to receive payments | Yes | - |
| `SKALE_NETWORK_ID` | EVM Chain ID (e.g. `skale-nebula`) | Yes | `skale-nebula` |
| `SKALE_ASSET_ADDRESS` | ERC-20 Token Address for payments | Yes | - |
| `GOOGLE_GENERATIVE_AI_API_KEY` | Gemini API Key | Yes | - |
| `FACILITATOR_URL` | x402 Facilitator URL | Yes | - |
| `DB_PATH` | Path to SQLite database file | No | `socratic.db` |
| `PORT` | Server port | No | `3000` |
| `SESSION_MAX_AGE` | Session TTL in seconds | No | `7776000` (90 days) |

## API Reference

### `GET /`
Returns API information and status.

### `GET /health`
Health check endpoint. Returns `{"status": "operational"}`.

### `POST /ask`
The main interaction endpoint.
- **Auth**: Requires `Authorization: Bearer <token>` or `Payment-Signature` header if payment is required.
- **Status 402**: Returns payment requirements (price, asset, destination) if payment is needed.
- **Status 200**: Returns the model's reply if verified or free tier (if configured).

**Request Body:**
```json
{
  "message": "I want to understand recursion.",
  "session_id": "(Optional) UUID to continue a conversation"
}
```

**Response (402 Payment Required):**
```json
{
  "accepts": [
    {
      "scheme": "exact",
      "price": { "amount": "100", "asset": "0x..." },
      "payTo": "0x..."
    }
  ]
}
```

**Response (200 OK):**
```json
{
  "reply": "Imagine a set of Russian dolls... What happens when you open the last one?",
  "session_id": "019468c8-b184-7299-80bf-104997327771"
}
```

## Testing

Run the test suite using Bun's native test runner:

```bash
bun test
```

## How It Works

1. **Context Management**: The server uses a hidden "Context State" summary that evolves with every turn, allowing the AI to remember long conversations without sending the entire history to the LLM every time.
2. **History Truncation**: Messages stored in history are truncated to 500 characters max to prevent large messages from causing unprofitable carry-forward costs. The progressive summary captures the full context.
3. **Pricing**: Dynamic pricing based on input length with a minimum price floor (see [Pricing Model](#pricing-model)).
4. **Session Pruning**: Old sessions (default > 90 days) are automatically pruned to save space.

## Pricing Model

The API uses dynamic pricing calculated in [`src/lib/pricing.ts`](./src/lib/pricing.ts). The formula ensures profitability while keeping costs fair for users.

### Why Estimated Values?

You might wonder why we use **estimated token counts** instead of calculating the actual context size for each request. This is a limitation of the x402 payment flow:

1. **Price must be calculated before payment verification** - The client needs to know the price to sign the payment
2. **User identity comes from the payment** - We extract the wallet address from `paymentPayload.payload.authorization.from`
3. **Context is keyed by wallet + session** - We can't load user-specific context without knowing their wallet

Since the wallet is only available **after** payment verification, we cannot know the actual context size when calculating the price. Instead, we use estimated values based on typical request/response sizes, which works well because:
- The progressive summary keeps context size relatively stable
- The system prompt is fixed
- User inputs vary but the per-character charge handles this

### Formula

```
Price = max(CalculatedPrice, MinimumPrice)

Where:
  CalculatedPrice = (InputChars × PricePerChar) + BaseCost
  BaseCost = (EstimatedInputTokens + EstimatedOutputTokens) × CostPerToken × MarginMultiplier
```

### Default Configuration

| Parameter | Value | Description |
|-----------|-------|-------------|
| `GEMINI_COST_PER_TOKEN` | $0.0000003 | Gemini 2.5 Flash: $0.30 per 1M tokens |
| `ESTIMATED_INPUT_TOKENS` | 1450 | System prompt + context + history (6×500 chars) |
| `ESTIMATED_OUTPUT_TOKENS` | 190 | Reply + context_state + main_goal |
| `MARGIN_MULTIPLIER` | 2.0 | 100% profit margin (2× cost) |
| `MINIMUM_PRICE` | $0.000001 | Smallest USDC transaction (6 decimals) |
| `CHARS_PER_TOKEN` | 4 | Character-to-token conversion ratio |

> **About the minimum price:** We set `MINIMUM_PRICE` to `$0.000001` (1 atomic unit), which is the smallest possible transaction with USDC's 6 decimal places. We can use this ultra-low minimum because **SKALE is gasless** — there are no transaction fees to cover. If you deploy on a network with gas costs (Ethereum, Polygon, etc.), you should increase this value to cover the expected gas fees per transaction.

### Example Pricing

With the default configuration and SKALE's gasless transactions, the calculated price is always used (minimum is $0.000001):

| User Input | Final Price |
|------------|-------------|
| "Hello" (5 chars) | **$0.000985** |
| 100 characters | **$0.001000** |
| 500 characters | **$0.001060** |
| 1000 characters | **$0.001135** |

> **Note:** The base price (~$0.00098) accounts for the system prompt plus maximum history (6 messages × 500 chars). All requests exceed the $0.000001 minimum.

### Customizing Pricing

All pricing constants are at the top of `src/lib/pricing.ts`:

```typescript
// =============================================================================
// PRICING CONFIGURATION - Adjust these values to change pricing
// =============================================================================

const GEMINI_COST_PER_TOKEN = 0.0000003;  // Update if model pricing changes
const ESTIMATED_INPUT_TOKENS = 1450;      // System prompt + context + history
const ESTIMATED_OUTPUT_TOKENS = 190;      // Adjust based on response size
const MARGIN_MULTIPLIER = 2.0;            // 1.0 = 0%, 2.0 = 100%, 3.0 = 200%
const MINIMUM_PRICE = 0.000001;           // Smallest USDC tx (SKALE is gasless)
const CHARS_PER_TOKEN = 4;                // Typical for English text
export const MAX_HISTORY_MESSAGE_CHARS = 500; // Truncate history messages
```

#### Common Adjustments

**Change profit margin:**
```typescript
const MARGIN_MULTIPLIER = 1.5;  // 50% margin instead of 100%
```

**Increase minimum price (for networks with gas costs):**
```typescript
const MINIMUM_PRICE = 0.01;  // $0.01 minimum to cover gas on Ethereum/Polygon
```

**Switch AI model (e.g., to GPT-4):**
```typescript
const GEMINI_COST_PER_TOKEN = 0.00003;  // GPT-4 is 100× more expensive
const ESTIMATED_INPUT_TOKENS = 1500;
const ESTIMATED_OUTPUT_TOKENS = 300;
```

**Increase history truncation (for more context, but higher costs):**
```typescript
export const MAX_HISTORY_MESSAGE_CHARS = 1000; // 1000 chars per message
const ESTIMATED_INPUT_TOKENS = 2200;           // Adjust to match: 6 × 1000 / 4 = 1500 extra tokens
```

## ⚠️ Custom Payment Flow (Important for Learners)

This example **does not use the stock `paymentMiddleware`** from `@x402/hono`. Instead, it implements a custom payment verification flow for performance reasons.

### The Problem

The standard `@x402/hono` middleware follows this sequence:

```
1. Receive request
2. Verify payment ✓
3. Execute your handler (AI response) ✓
4. Await settlement ← BLOCKS HERE (~15-20 seconds)
5. Return response to client
```

Settlement is the process of confirming to the facilitator that you provided the service and the payment should be finalized. The middleware **awaits** this before returning the response, which adds significant latency for long-running settlements.

### Our Solution

We use `x402HTTPResourceServer` directly instead of the middleware wrapper:

```typescript
// Verify payment manually
const result = await httpServer.processHTTPRequest({ ... });

if (result.type === "payment-error") {
  return c.json(result.response.body, 402);
}

// Generate AI response
const aiResponse = await generateSocraticResponse(...);

// Settle payment ASYNCHRONOUSLY - don't await!
httpServer.processSettlement(paymentPayload, paymentRequirements)
  .then(() => console.log("Settlement completed"))
  .catch((err) => console.error("Settlement failed:", err));

// Return immediately - client doesn't wait for settlement
return c.json({ reply: aiResponse.reply, session_id });
```

### Tradeoffs

| Aspect | Stock Middleware | Our Custom Flow |
|--------|-----------------|-----------------|
| **Response Time** | ~20-25 seconds | ~5 seconds |
| **Implementation** | Simple, one-liner | More code, manual verification |
| **Settlement Guarantee** | Client knows settlement succeeded | Client doesn't know settlement status |
| **Error Handling** | Settlement errors block response | Must handle async settlement failures |
| **SDK Updates** | Automatic | May need manual updates |

### When to Use Each Approach

**Use stock `paymentMiddleware` when:**
- Response time isn't critical
- You need guaranteed settlement confirmation before responding
- You want minimal custom code

**Use custom flow (like this example) when:**
- Low latency is essential (AI APIs, real-time services)
- Settlement can be handled asynchronously
- You can tolerate occasional settlement failures

### Handling Settlement Failures

Since settlement is async, you should:
1. **Log failures** for monitoring
2. **Implement retries** if needed
3. **Consider a dead-letter queue** for failed settlements

In practice, settlement failures are rare. The payment is already verified before your service runs—settlement just confirms delivery.

## License

Apache-2.0
