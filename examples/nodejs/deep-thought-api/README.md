# 🧠 Deep Thought API

> "After 7.5 million years of computation, the answer is... **42**"

A nerdy "Hello World" example demonstrating how to monetize an API with the [x402 protocol](https://github.com/coinbase/x402) and [Kobaru gateway](https://kobaru.io).

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
- A Solana wallet address to receive payments

### Installation

```bash
# Clone the repository
git clone https://github.com/kobaru/api-paywall-cookbook.git
cd api-paywall-cookbook/examples/nodejs/deep-thought-api

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your Solana wallet address
```

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
# First, set your wallet as a secret:
npx wrangler secret put RESOURCE_WALLET_ADDRESS --config deploy/cloudflare/wrangler.jsonc

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
  resourceWalletAddress: process.env.RESOURCE_WALLET_ADDRESS!,
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
- Accepted network (Solana Devnet)
- Your wallet address
- Asset (USDC on Solana)

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
| `RESOURCE_WALLET_ADDRESS` | Yes | - | Your Solana wallet address |
| `FACILITATOR_URL` | No | `https://gateway.kobaru.io` | x402 facilitator URL |
| `PORT` | No | `3000` | Server port (Node.js/Docker) |

---

## 💡 Key Concepts Demonstrated

1. **Platform-Agnostic Design** — Same app runs on Cloudflare, Node.js, Docker, etc.
2. **Hono Framework** — Lightweight, fast, multi-runtime framework
3. **x402 Protocol** — Native micropayments with the HTTP 402 status code
4. **Solana Payments** — Uses Solana Devnet for micropayments via `@x402/svm`
5. **Kobaru Facilitator** — Handles payment verification and settlement

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

*Don't Panic! 🐬*
