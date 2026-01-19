# Socratic Mentor API

*I possess no wisdom... but those who associate with me discover within themselves many fair things."* — Socrates (via Plato, Theaetetus)

> Some say AI makes people dumber by providing ready answers. We use the ancient **Socratic Method** to fix that.

A wise AI tutor that guides you to discover answers through thoughtful questions—monetized via the **x402 protocol**.

> [!WARNING]
> **Friedrich Nietzsche does not endorse or approve this project.**
>
> By automating the Socratic Method, this API empowers the **Theoretical Man** at the expense of the **Dionysian spirit**. To Nietzsche, joy springs from instinct and chaos, not from the cold logic of an algorithm. Consequently, this project is a monument to the 'Tyranny of Reason.' If you believe that `Reason == Virtue == Happiness`, you are in the right place. But if you prefer the dangerous passion of life over the suffocating net of dialectics, turn back now. You have been warned!

---

## The Path to Wisdom

*False words are not only evil in themselves, but they infect the soul with evil.* — Socrates (via Plato, Phaedo)

This high-performance API uses the **Bun** runtime to deliver a Socratic teaching experience. Instead of giving direct answers, it asks probing questions that guide users toward understanding.

**Key Features:**

| | Feature | Description |
|---|---------|-------------|
| 🎓 | **Socratic Method** | Specialized prompts guide users to discover answers themselves |
| 💳 | **x402 Payments** | Native micropayment support via SKALE (or any EVM chain) |
| 💬 | **Stateful Sessions** | Maintains conversation context using SQLite |
| ⚡ | **Dynamic Pricing** | Pay based on input length with transparent cost calculation |
| 🚀 | **High Performance** | Built on Bun + Hono for sub-second response times |
| 🔒 | **Enterprise Security** | Input validation, SQL injection protection, atomic operations |

---

## The First Steps

*"The beginning is the most important part of the work."* — Plato (The Republic)

### Prerequisites

- [Bun](https://bun.sh) v1.1+
- Google AI Studio API Key ([Get one here](https://aistudio.google.com))
- EVM wallet address to receive payments

### Setup

```bash
# 1. Install dependencies
bun install

# 2. Configure environment
cp .env.example .env
# Edit .env with your credentials (see Configuration section)

# 3. Start the server
bun run dev
```

The server runs at `http://localhost:3000`.

---

## Configuration

| Variable | Description | Required | Default |
|----------|-------------|:--------:|---------|
| `SKALE_WALLET_ADDRESS` | Your EVM address to receive payments | ✅ | — |
| `SKALE_NETWORK_ID` | EVM Chain ID | ✅ | `eip155:1187947933` |
| `SKALE_ASSET_ADDRESS` | ERC-20 token address for payments | ✅ | `0x85889c8c714505E0c94b30fcfcF64fE3Ac8FCb20` |
| `GOOGLE_GENERATIVE_AI_API_KEY` | Gemini API key | ✅ | — |
| `FACILITATOR_URL` | x402 facilitator URL | ✅ | https://gateway.kobaru.io |
| `KOBARU_API_KEY` | Kobaru API key | No | — |
| `DB_PATH` | SQLite database path | | `socratic.db` |
| `PORT` | Server port | | `3000` |
| `SESSION_MAX_AGE` | Session TTL in seconds | | `7776000` (90 days) |

---

## The Dialogue

*"Opinion is the medium between knowledge and ignorance."* — Plato (The Republic)

### `GET /`

Returns API information and status.

### `GET /health`

Health check endpoint.

```json
{ "status": "operational" }
```

### `POST /ask`

The main interaction endpoint. Requires payment via x402 protocol.

**Request:**

```json
{
  "message": "I want to understand recursion.",
  "session_id": "(optional) UUID to continue a conversation"
}
```

**Response (200 OK):**

```json
{
  "reply": "Imagine a set of Russian dolls... What happens when you open the last one?",
  "session_id": "019468c8-b184-7299-80bf-104997327771"
}
```

**Response Headers:**
- `X-Balance-Remaining` — Current balance in atomic units

**Response (402 Payment Required):**

```json
{
  "detail": "Payment Required",
  "error": "Insufficient Balance",
  "accepts": [
    {
      "scheme": "exact",
      "price": { "amount": "985", "asset": "0x..." },
      "network": "skale-nebula",
      "payTo": "0x..."
    }
  ]
}
```

---

## The Price of Knowledge

*"There is only one good, knowledge, and one evil, ignorance."* — Socrates

The API calculates prices dynamically based on input length. See [`src/lib/pricing.ts`](./src/lib/pricing.ts) for implementation.

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
| `GEMINI_COST_PER_TOKEN` | $0.0000003 | Gemini 2.5 Flash pricing |
| `ESTIMATED_INPUT_TOKENS` | 1450 | System prompt + context + history |
| `ESTIMATED_OUTPUT_TOKENS` | 190 | Reply + context state |
| `MARGIN_MULTIPLIER` | 2.0 | 100% profit margin |
| `MINIMUM_PRICE` | $0.000001 | Smallest USDC transaction |
| `MAX_HISTORY_MESSAGE_CHARS` | 500 | Characters per history message |
| `MAX_HISTORY_MESSAGES` | 6 | Messages kept in history |

### Example Prices

| User Input | Price |
|------------|-------|
| "Hello" (5 chars) | $0.000985 |
| 100 characters | $0.001000 |
| 500 characters | $0.001060 |
| 1000 characters | $0.001135 |

> **Note:** The minimum price is set to $0.000001. If deploying on networks with gas costs (Base, Solana), increase this value to cover transaction fees.

### Customizing Pricing

Edit the constants at the top of `src/lib/pricing.ts`:

```typescript
const GEMINI_COST_PER_TOKEN = 0.0000003;  // Model pricing
const ESTIMATED_INPUT_TOKENS = 1450;      // System + context + history
const ESTIMATED_OUTPUT_TOKENS = 190;      // Response size
const MARGIN_MULTIPLIER = 2.0;            // 1.5 = 50%, 2.0 = 100%
const MINIMUM_PRICE = 0.000001;           // Increase for gas-heavy networks
export const MAX_HISTORY_MESSAGE_CHARS = 500;
export const MAX_HISTORY_MESSAGES = 6;
```

### Why Estimated Tokens?

*"True wisdom comes to each of us when we realize how little we understand."*

The x402 flow requires calculating the price **before** payment verification. Since user identity comes from the payment signature, we can't load user-specific context before knowing the price. Estimated values work well because:

- The progressive summary keeps context size stable
- The system prompt is fixed
- Per-character charging handles input variation

---

## The Architecture

*"The unexamined life is not worth living."* — Socrates

### The Ledger of Truth

*"An unexamined balance is not worth spending."*

The system implements an internal ledger to handle micropayments efficiently and prevent common attacks.

> [!WARNING]
> **This is a simplified demonstration.** Ledgers are complex systems requiring careful implementation. This solution works for simple APIs, but for mission-critical production systems handling significant funds, consider using a full-fledged ledger solution like [Kobaru's transparent proxy](https://kobaru.io) with enterprise-grade security.

**Flow:**

1. **Price Calculation** — Calculated from actual request body (prevents bait-and-switch)
2. **Identity Verification** — Wallet address extracted from payment signature
3. **Balance Check** — `Available = StoredBalance + NewPayment`
4. **Payment Enforcement** — If sufficient, serve request; otherwise return 402 with deficit amount

**Benefits:**

| Benefit | Description |
|---------|-------------|
| **Pay Once, Use Many** | Pay $1.00 upfront, make ~1000 requests |
| **No Accounts Needed** | Identity derived from payment signatures |
| **Micro-Payment Aggregation** | Reduces on-chain interactions |
| **Transparency** | `X-Balance-Remaining` header shows current balance |

### The Optimistic Path

*"He is richest who is content with the least, for content is the wealth of nature."* Socrates

This example prioritizes UX over strict settlement ordering:

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Receive request                                          │
│ 2. Verify payment signature ✓                               │
│ 3. Reserve balance atomically ✓                             │
│ 4. Generate AI response ✓                                   │
│ 5. Return response immediately ← User gets fast response    │
│ 6. Settle payment async (background) ← Credit on success    │
└─────────────────────────────────────────────────────────────┘
```

**Tradeoff:** If settlement fails, the user received one "free" service but their balance stays at 0, preventing further abuse.

> [!CAUTION]
> **Fraud Risk:** If settlements are consistently failing, bad actors may discover this and exploit the system—firing millions of requests knowing they won't actually pay. Evaluate your specific context and consider:
> - **Monitoring** — Track settlement failure rates and alert on anomalies
> - **Abuse Prevention** — Add logic to block users with multiple failed settlements
> - **Rate Limiting** — Consider per-wallet request limits as a safeguard
> 
> Balance UX with security based on your risk tolerance and customer needs.

> **Tip:** Kobaru's users can check all transactions (successful and failed) in the [Kobaru dashboard](https://kobaru.io).

### The Memory of Discourse

*"The mind is not a vessel to be filled, but a fire to be kindled."* — Plutarch

- **Progressive Summary** — Hidden context state evolves each turn, allowing long conversations without sending full history
- **History Truncation** — Messages capped at 500 chars to bound costs
- **Session Pruning** — Old sessions (>90 days) automatically cleaned up

---

## x402 Extensions

This API implements the **x402-balance** extension per the [x402 v2 spec](https://github.com/coinbase/x402/blob/main/specs/x402-specification-v2.md).

| Field | Value | Description |
|-------|-------|-------------|
| `supportsTopup` | `true` | Overpayments credited to balance |
| `supportsBalance` | `true` | Maintains per-user balance ledger |
| `identityMechanism` | `"previous-proof"` | Reuse payment signature for identity |

**Example 402 Response:**

```json
{
  "detail": "Payment Required",
  "accepts": [...],
  "extensions": {
    "x402-balance": {
      "info": {
        "supportsTopup": true,
        "supportsBalance": true,
        "identityMechanism": "previous-proof",
        "description": "Overpayments are credited. Reuse your payment proof for identity."
      }
    }
  }
}
```

### Using Your Balance

*"Money is a guarantee that we may have what we want in the future. Though we need nothing at the moment, it ensures the possibility of satisfying a new desire when it arises."* — Aristotle (Nicomachean Ethics)

The API supports **overpayments** and **balance reuse**. Pay more than required, and the surplus is credited to your account. Reuse your payment signature to identify yourself and spend from your balance.

**Step 1: Make an Overpayment**

When making a payment, you can pay more than the required amount. The surplus is automatically credited to your balance after settlement.

After successful settlement, the server logs:
```
[Ask] Settlement Successful.
[Ask] Credited Surplus: 4012  # ~$0.004 credited
```

**Step 2: Extract Your Signature for Identity**

From your payment response, extract the signature from the `PAYMENT-SIGNATURE` payload:

```bash
# Decode the PAYMENT-SIGNATURE to get your signature
echo '<your-payment-signature-base64>' | base64 -d | jq -r '.payload.signature'
# Returns: 0x1fe628d8...761c
```

**Step 3: Reuse Signature for Subsequent Requests**

Use the signature as proof of identity in the `Authorization` header. No new payment needed—funds are deducted from your balance.

```bash
# Create the identity token
SIGNATURE="0x1fe628d8e75ef7c0fb6ed..."
AUTH_TOKEN=$(echo -n "{\"proof\":\"$SIGNATURE\"}" | base64 -w 0)

# Make requests using your balance
curl -X POST http://localhost:3000/ask \
  -H "Content-Type: application/json" \
  -H "Authorization: x402 $AUTH_TOKEN" \
  -d '{"message": "Continue our conversation!"}'
```

**Response Headers:**
```
X-Balance-Remaining: 3025  # Balance after deduction
```

> [!TIP]
> **Machine Clients:** Store the signature from your first successful payment and reuse it in all subsequent requests. Only make a new payment when `X-Balance-Remaining` is insufficient.

---

## The Unconventional Path

"Know thyself." — Delphic Maxim (adopted by Socrates)

This example **does not use** the standard `paymentMiddleware` from `@x402/hono`. Instead, it uses `x402HTTPResourceServer` directly for performance.

### Why?

The standard middleware blocks on settlement (~2-5 seconds):

```
Request → Verify → Handle → Await Settlement → Response
                              ↑
                         ~2-5s delay
```

Our custom flow settles asynchronously:

```
Request → Verify → Reserve → Handle → Response (immediate)
                                    ↘ Settle (background)
```

### Comparison

| Aspect | Stock Middleware | Custom Flow |
|--------|-----------------|-------------|
| Response Time | ~2-5 seconds | ~1 second |
| Implementation | One-liner | More code |
| Settlement Guarantee | Before response | Async |
| Best For | Non-critical latency | Real-time services |

### When to Use Stock Middleware

- Response time isn't critical
- You need guaranteed settlement before responding  
- You want minimal custom code

---

## The Guardian

*"It is better to suffer wrong than to do wrong."* — Socrates (via Plato, Gorgias)

### Overview

This API implements **production-grade security**:

```
┌─────────────────────────────────────────────────┐
│ Layer 1: Input Validation                       │
│   → Wallet addresses, user input, signatures    │
├─────────────────────────────────────────────────┤
│ Layer 2: Parameterized Queries                  │
│   → All SQL uses prepared statements            │
├─────────────────────────────────────────────────┤
│ Layer 3: Atomic Operations                      │
│   → Conditional updates prevent race conditions │
├─────────────────────────────────────────────────┤
│ Layer 4: Business Logic                         │
│   → Server-side pricing, balance verification   │
└─────────────────────────────────────────────────┘
```

### Input Validation

| Validation | Pattern/Limit | Prevents |
|------------|---------------|----------|
| Wallet Address | `0x[a-fA-F0-9]{40}` | SQL injection |
| User Message | 10,000 chars max, sanitized | DoS, prompt injection |
| Session ID | UUID format | SQL injection |
| Signature Hash | Alphanumeric + base64, 1000 chars | Header injection |
| Balance Amount | 0 to 10³⁰ | Integer overflow |

### Financial Security

| Protection | Mechanism |
|------------|-----------|
| **Double-Spend Prevention** | Atomic conditional SQL updates |
| **Bait-and-Switch** | Price calculated from actual body |
| **Replay Attacks** | Payment signatures tracked in ledger |
| **Race Conditions** | SQLite conditional updates |

### Production Hardening

- **Request ID Middleware** — Unique ID for every request (`X-Request-ID`)
- **Security Headers** — CSP, X-Content-Type-Options, HSTS
- **Structured Logging** — Settlement failures logged with context
- **Graceful Shutdown** — SIGTERM/SIGINT close DB cleanly
- **Fail-Fast Startup** — Refuses to start with missing config
- **Payment Pruning** — Old records (90+ days, zero balance) auto-cleaned

### Rate Limiting

*"Nothing in excess."* — Solon (One of the Seven Sages)

This API **does not implement rate limiting** by design. For paid-only APIs, payment acts as a natural throttle.

> ⚠️ **Consider adding rate limiting if:**
> - You expect runaway AI agent loops
> - You have strict upstream quotas
> - You want fair usage policies
> - Your infrastructure has capacity constraints

---

## The Trials

*"The only true wisdom is in knowing you know nothing."* — Socrates (Apology)

Run the test suite:

```bash
bun test
```

The suite includes 46+ tests covering:
- Input validation and sanitization
- Balance operations and atomicity
- Payment flow and edge cases
- Client isolation and security scenarios

---

## The Tools of the Trade

| Component | Technology |
|-----------|------------|
| Runtime | [Bun](https://bun.sh) v1.1+ |
| Framework | [Hono](https://hono.dev) |
| Payments | x402 SDK v2 |
| AI | Vercel AI SDK (Google Gemini) |
| Database | `bun:sqlite` |

---

## Legal

*"The law is reason, free from passion."* — Aristotle

You are responsible for using this example in compliance with applicable laws. The authors and contributors are not liable for damages or legal issues arising from use. Understand the legal implications of managing balances, handling payments, and relevant regulations.

---

## License

Apache-2.0
