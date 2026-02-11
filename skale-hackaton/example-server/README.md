# 🧠 Deep Thought API
## 🎯 SKALE HACKATHON EDITION 🎯

> **SPECIAL BUILD FOR:** San Francisco Agentic Commerce x402 Hackathon
> **NETWORK FOCUS:** SKALE networks only (Solana and Base removed for simplicity)
> **FOR FULL MULTI-CHAIN SUPPORT:** See the [original Deep Thought API](https://github.com/kobaru/api-paywall-cookbook/tree/main/examples/nodejs/deep-thought-api)

---

> "After 7.5 million years of computation, the answer is... **42**"

A nerdy "Hello World" example demonstrating how to monetize an API with the [x402 protocol](https://github.com/coinbase/x402) and [Kobaru gateway](https://kobaru.io).

**🎯 PRE-CONFIGURED FOR HACKATHON SUCCESS:**
- ✅ **Zero Multi-Chain Complexity:** Only SKALE networks (no Solana/Base confusion)
- ✅ **Default Network:** Pre-configured for SKALE Hackathon Sandbox
- ✅ **Builder-Friendly:** Perfect for learning x402 protocol during the hackathon
- ✅ **Copy-Friendly:** Clean, well-documented code ready to fork for your own APIs
- ✅ **Educational:** Every line explained - great reference implementation

## 🌌 What is this?

This API channels the power of Deep Thought, the legendary supercomputer from Douglas Adams' *The Hitchhiker's Guide to the Galaxy*. For a mere fraction of a cent, you can receive the Answer to the Ultimate Question of Life, the Universe, and Everything.

**Spoiler:** It's 42.

## 📁 Project Structure

```
deep-thought-api/
├── src/
│   └── app.ts              # Pure Hono app (platform-agnostic)
├── deploy/
│   ├── cloudflare/         # Cloudflare Workers deployment
│   │   ├── index.ts
│   │   └── wrangler.jsonc
│   ├── node/               # Node.js server deployment
│   │   └── server.ts
│   └── docker/             # Docker deployment
│       ├── Dockerfile
│       └── docker-compose.yml
├── package.json
├── .env.example
└── README.md
```

The API logic in `src/app.ts` is **100% platform-agnostic**. The `deploy/` directory contains adapters for different hosting platforms.

---

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- A SKALE wallet address to receive payments (MetaMask or any EVM wallet)

### Installation

```bash
# Navigate to the hackathon example
cd skale-hackaton/example-server

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env and add your SKALE_WALLET_ADDRESS
```

**💡 Need a wallet?** Use MetaMask or generate one with `cast wallet new`

**💡 Need testnet funds?** Join the hackathon Telegram: https://t.me/c/2825693624/538

---

## 🖥️ Deployment Options

### Option 1: Node.js (Development)

```bash
# Start development server with hot reload
npm run dev

# Or explicitly:
npm run dev:node
```

Server runs at `http://localhost:3000`

### Option 2: Cloudflare Workers

```bash
# Development
npm run dev:cloudflare

# Production deployment
# First, set your wallet secret:
npx wrangler secret put SKALE_WALLET_ADDRESS --config deploy/cloudflare/wrangler.jsonc

# Deploy
npm run deploy:cloudflare
```

### Option 3: Docker

```bash
# Build the image
npm run docker:build

# Run with environment file
npm run docker:run

# Or use docker-compose:
docker-compose -f deploy/docker/docker-compose.yml up
```

### Option 4: Other Platforms

The `src/app.ts` exports a `createApp(config)` function that returns a standard Hono app. You can easily create adapters for:

- **Vercel**: Use `@hono/vercel`
- **AWS Lambda**: Use `@hono/aws-lambda`
- **Deno**: Hono works natively with Deno
- **Bun**: Hono works natively with Bun

Example for Vercel:
```typescript
import { handle } from '@hono/vercel';
import { createApp } from './src/app';

export default handle(createApp({
  solanaWalletAddress: process.env.SOLANA_WALLET_ADDRESS,
  baseWalletAddress: process.env.BASE_WALLET_ADDRESS,
  facilitatorUrl: process.env.FACILITATOR_URL!,
}));
```

---

## 📡 Endpoints

| Endpoint | Method | Price | Description |
|----------|--------|-------|-------------|
| `/` | GET | Free | API introduction and available endpoints |
| `/answer` | GET | $0.001 | The Ultimate Answer (42) |
| `/health` | GET | Free | Health check |

---

## 🔧 How It Works

### Free Request to `/`

```bash
curl http://localhost:3000/
```

Response:
```json
{
  "name": "Deep Thought API",
  "description": "After 7.5 million years of computation...",
  "hint": "The answer awaits at /answer... for a small fee."
}
```

### Paid Request to `/answer`

First request (without payment) returns `402 Payment Required`:

```bash
curl -i http://localhost:3000/answer
```

Response:
```
HTTP/1.1 402 Payment Required
PAYMENT-REQUIRED: eyJ...base64-encoded-payment-requirements...
```

The `PAYMENT-REQUIRED` header contains base64-encoded JSON with:
- Payment amount ($0.001)
- Accepted network (SKALE Hackathon Sandbox)
- Your wallet address
- Asset (USDC on SKALE)

After payment via an x402 client:
```json
{
  "question": "What is the Answer to the Ultimate Question of Life, the Universe, and Everything?",
  "answer": 42,
  "computationTime": "7.5 million years",
  "computer": "Deep Thought"
}
```

---

## ⚙️ Configuration

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `SKALE_WALLET_ADDRESS` | **Yes** | - | Your SKALE wallet address (where you'll receive USDC payments) |
| `KOBARU_API_KEY` | No | - | Your Kobaru API key (enables console access, metrics, and logs) |
| `FACILITATOR_URL` | No | `https://gateway.kobaru.io` | x402 facilitator URL |
| `PORT` | No | `3000` | Server port (Node.js/Docker) |

**🎯 Hackathon Build:** Only `SKALE_WALLET_ADDRESS` is required. The `KOBARU_API_KEY` is optional but recommended for accessing the Kobaru Console features!

---

## 💡 Key Concepts Demonstrated

1. **Platform-Agnostic Design** — Same app runs on Cloudflare, Node.js, Docker, etc.
2. **Hono Framework** — Lightweight, fast, multi-runtime framework
3. **x402 Protocol** — Native micropayments with the HTTP 402 status code
4. **EVM Payments** — SKALE blockchain payments via `@x402/evm` (hackathon build)
5. **Kobaru Facilitator** — Handles payment verification and settlement
6. **Universal EVM Compatibility** — Works with ANY EVM chain (not just viem-defined chains)

**🎯 Hackathon Build:** This simplified version focuses on SKALE to reduce complexity.
For multi-chain support (Solana + Base + SKALE), see the [original Deep Thought API](https://github.com/kobaru/api-paywall-cookbook/tree/main/examples/nodejs/deep-thought-api).

---

## 🔗 Resources

- [x402 Protocol](https://github.com/coinbase/x402)
- [x402 v2 Specification](https://github.com/coinbase/x402/blob/main/specs/x402-specification-v2.md)
- [Kobaru Documentation](https://docs.kobaru.io)
- [Hono Framework](https://hono.dev)

---

## 📜 Quote

> "I think the problem, to be quite honest with you, is that you've never actually known what the question is."
> 
> — Deep Thought, *The Hitchhiker's Guide to the Galaxy*

---

## 🚀 Powered by Kobaru

**Kobaru makes blockchain payments simple** - focus on building your winning solution, not payment infrastructure.

### Hackathon Superpowers with Kobaru

✅ **Real-Time Debugging** - See payment logs live in the console as you test
✅ **Success Metrics** - Track payment volume, conversion, and revenue to measure impact
✅ **Zero Infrastructure** - No blockchain nodes, RPC endpoints, or gas fee headaches
✅ **Free Access** - Full features available during the hackathon

### Get Started

1. 🔗 **Sign up for free:** https://console.kobaru.io/sign-up
2. 🔑 **Generate your API key** (optional but recommended) at the console and set `KOBARU_API_KEY` in your `.env` file
3. 🔍 **Open the console** while testing to see payments in real-time
4. 📊 **Track metrics** to optimize your solution and impress judges
5. 📚 **Learn more:** https://www.kobaru.io

**💡 Pro Tip:** Keep the Kobaru Console open during your demo - showing live payment logs flowing through your API is a powerful way to prove your solution works!

---

## For Builders 🛠️

This hackathon edition is intentionally streamlined to serve as an **excellent reference implementation** for developers building their own x402-enabled APIs:

### Why This Code is Valuable for Builders:

1. **Complete x402 Server Implementation:** Shows the full server-side flow from payment requirement to verification.

2. **Well-Documented Architecture:** Every function and concept is extensively commented - perfect for learning.

3. **Platform-Agnostic Design:** The factory pattern (`createApp(config)`) makes it easy to deploy anywhere (Node, Cloudflare, Docker, Vercel, etc.).

4. **Universal EVM Compatibility:** Uses the AssetAmount format that works with ANY EVM chain, not just those defined in viem.

5. **Pre-Configured for Hackathon:** All SKALE Sandbox parameters are already set up, so you can focus on building your API logic.

### Suggested Uses:

- **Fork for Your Own API:** Copy this structure and replace `/answer` with your actual API endpoints.
- **Learn x402 Protocol:** Read through the code to understand how server-side payment verification works.
- **Test with 007 Agent:** Use the companion test-agent in `../test-agent` to validate your API.
- **Reference Implementation:** Use this as a template when building production x402 APIs.

### Key Files to Study:

- `src/app.ts` — Core x402 integration (payment middleware, asset metadata)
- `deploy/node/server.ts` — Environment variable loading and validation
- `deploy/cloudflare/index.ts` — Serverless deployment pattern

### For Full Multi-Chain Support:

This is a simplified version for the hackathon. For production use cases requiring Solana or Base networks, see the **[original Deep Thought API](https://github.com/kobaru/api-paywall-cookbook/tree/main/examples/nodejs/deep-thought-api)** with full multi-chain support.

---

*Don't Panic! 🐬*
